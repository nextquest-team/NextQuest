import { db, games, genres, gameGenres, gamePlatforms, platforms, userFollowedGames } from "@nextquest/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { hydrateGamesByIgdbIds } from "../igdb/igdb.service.js";
import type { FollowedGameDTO } from "./follow.dto.js";

export type FollowDeps = {
  hydrate: (igdbIds: number[]) => Promise<number>;
};

function defaultFollowDeps(): FollowDeps {
  return { hydrate: (ids) => hydrateGamesByIgdbIds(ids) };
}

// Follow = hydrater le jeu dans le catalogue (no-op s'il y est deja) puis lier.
// Renvoie null si l'igdbId n'existe pas chez IGDB (rien n'a ete hydrate).
export async function followGame(
  userId: string,
  igdbId: number,
  deps: FollowDeps = defaultFollowDeps(),
): Promise<FollowedGameDTO | null> {
  await deps.hydrate([igdbId]);
  const [game] = await db.select({ id: games.id }).from(games).where(eq(games.igdbId, igdbId)).limit(1);
  if (!game) return null;
  await db.insert(userFollowedGames).values({ userId, gameId: game.id }).onConflictDoNothing();
  const [dto] = await buildFollowedDTOs([game.id]);
  return dto ?? null;
}

export async function unfollowGame(userId: string, igdbId: number): Promise<void> {
  const [game] = await db.select({ id: games.id }).from(games).where(eq(games.igdbId, igdbId)).limit(1);
  if (!game) return;
  await db
    .delete(userFollowedGames)
    .where(and(eq(userFollowedGames.userId, userId), eq(userFollowedGames.gameId, game.id)));
}

export async function listFollowedGames(userId: string): Promise<FollowedGameDTO[]> {
  const followed = await db
    .select({ gameId: userFollowedGames.gameId })
    .from(userFollowedGames)
    .where(eq(userFollowedGames.userId, userId));
  return buildFollowedDTOs(followed.map((f) => f.gameId));
}

// Construit les DTOs depuis la BDD : une requete jeux + une genres + une
// plateformes (pas de N+1), regroupees en memoire. Les genres/plateformes sans
// igdb_id (customs locaux) sont exclus : le DTO suit la forme du feed IGDB.
async function buildFollowedDTOs(gameIds: string[]): Promise<FollowedGameDTO[]> {
  if (gameIds.length === 0) return [];

  const rows = await db
    .select({
      id: games.id,
      igdbId: games.igdbId,
      title: games.title,
      releaseDate: games.releaseDate,
      releaseDatePrecision: games.releaseDatePrecision,
      coverUrl: games.coverUrl,
      hypes: games.igdbHypes,
    })
    .from(games)
    .where(inArray(games.id, gameIds))
    .orderBy(sql`${games.releaseDate} asc nulls last`, games.title);

  const genreRows = await db
    .select({ gameId: gameGenres.gameId, igdbId: genres.igdbId, name: genres.name, slug: genres.slug })
    .from(gameGenres)
    .innerJoin(genres, eq(genres.id, gameGenres.genreId))
    .where(inArray(gameGenres.gameId, gameIds));

  const platformRows = await db
    .select({ gameId: gamePlatforms.gameId, igdbId: platforms.igdbId, name: platforms.name })
    .from(gamePlatforms)
    .innerJoin(platforms, eq(platforms.id, gamePlatforms.platformId))
    .where(inArray(gamePlatforms.gameId, gameIds));

  return rows
    // Invariant : un jeu suivi provient toujours d'un lookup par igdbId (followGame
    // hydrate puis lie via games.igdbId), donc igdbId est non-null par construction ici.
    // Le filtre protege une evolution future (jeux customs sans igdbId).
    .filter((r) => r.igdbId != null)
    .map((r) => ({
      igdbId: r.igdbId!,
      title: r.title,
      releaseDate: r.releaseDate,
      releaseDatePrecision: r.releaseDatePrecision,
      coverUrl: r.coverUrl,
      hypes: r.hypes,
      genres: genreRows
        .filter((g) => g.gameId === r.id && g.igdbId != null)
        .map((g) => ({ igdbId: g.igdbId!, name: g.name, slug: g.slug })),
      platforms: platformRows
        .filter((p) => p.gameId === r.id && p.igdbId != null)
        .map((p) => ({ igdbId: p.igdbId!, name: p.name, abbreviation: null })),
    }));
}

import {
  db,
  userGames,
  games,
  gameGenres,
  gameTags,
  recommendations,
} from "@nextquest/db";
import { and, eq, count, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
import type { OwnedGameForProfile, SwipeDelta } from "./profile.js";
import type { Candidate } from "./scoring.js";

// Genres/tags groupes par gameId (1 requete IN), pour eviter le N+1.
async function genreTagIdsByGame(gameIds: string[]) {
  const g = new Map<string, string[]>();
  const t = new Map<string, string[]>();
  if (gameIds.length === 0) return { g, t };
  const [gr, tr] = await Promise.all([
    db
      .select({ gameId: gameGenres.gameId, id: gameGenres.genreId })
      .from(gameGenres)
      .where(inArray(gameGenres.gameId, gameIds)),
    db
      .select({ gameId: gameTags.gameId, id: gameTags.tagId })
      .from(gameTags)
      .where(inArray(gameTags.gameId, gameIds)),
  ]);
  for (const r of gr) g.set(r.gameId, [...(g.get(r.gameId) ?? []), r.id]);
  for (const r of tr) t.set(r.gameId, [...(t.get(r.gameId) ?? []), r.id]);
  return { g, t };
}

export async function getOwnedForProfile(
  userId: string,
): Promise<OwnedGameForProfile[]> {
  const rows = await db
    .select({
      gameId: games.id,
      status: userGames.status,
      playtimeMinutes: userGames.playtimeMinutes,
      rating: userGames.rating,
      normallyMinutes: games.avgPlaytime,
    })
    .from(userGames)
    .innerJoin(games, eq(userGames.gameId, games.id))
    .where(eq(userGames.userId, userId));
  const { g, t } = await genreTagIdsByGame(rows.map((r) => r.gameId));
  return rows.map((r) => ({
    gameId: r.gameId,
    status: r.status,
    playtimeMinutes: r.playtimeMinutes,
    rating: r.rating,
    normallyMinutes: r.normallyMinutes,
    // count non relu ici : avgPlaytime n'est peuple QUE si count>=10 (Task 2),
    // donc une duree presente est deja fiable.
    ttbCount: r.normallyMinutes != null ? 10 : null,
    genreIds: g.get(r.gameId) ?? [],
    tagIds: t.get(r.gameId) ?? [],
  }));
}

// Frequence de chaque genre/tag dans le catalogue, pour l'IDF.
export async function getDimensionFrequencies(): Promise<{
  totalGames: number;
  freqs: { dimension: string; freq: number }[];
}> {
  const [{ totalGames }] = await db
    .select({ totalGames: count() })
    .from(games);
  const gf = await db
    .select({ id: gameGenres.genreId, freq: count() })
    .from(gameGenres)
    .groupBy(gameGenres.genreId);
  const tf = await db
    .select({ id: gameTags.tagId, freq: count() })
    .from(gameTags)
    .groupBy(gameTags.tagId);
  return {
    totalGames,
    freqs: [
      ...gf.map((r) => ({ dimension: `g:${r.id}`, freq: r.freq })),
      ...tf.map((r) => ({ dimension: `t:${r.id}`, freq: r.freq })),
    ],
  };
}

// Feedback passe (liked/dismissed/added) + genres/tags du jeu concerne.
export async function getSwipeDeltas(userId: string): Promise<SwipeDelta[]> {
  const rows = await db
    .select({ gameId: recommendations.gameId, feedback: recommendations.feedback })
    .from(recommendations)
    .where(
      and(
        eq(recommendations.userId, userId),
        isNotNull(recommendations.feedback),
      ),
    );
  const { g, t } = await genreTagIdsByGame(rows.map((r) => r.gameId));
  return rows.map((r) => ({
    feedback: r.feedback as SwipeDelta["feedback"],
    genreIds: g.get(r.gameId) ?? [],
    tagIds: t.get(r.gameId) ?? [],
  }));
}

// Candidats du bucket "library_unplayed" : jeux de la biblio avec status backlog/wishlist
// et playtime < 30 min (ou null).
const UNPLAYED_MAX_MINUTES = 30;

export async function getLibraryUnplayedCandidates(userId: string): Promise<Candidate[]> {
  const rows = await db
    .select({
      gameId: games.id,
      igdbRating: games.igdbRating,
      igdbRatingCount: games.igdbRatingCount,
      igdbHypes: games.igdbHypes,
    })
    .from(userGames)
    .innerJoin(games, eq(userGames.gameId, games.id))
    .where(
      and(
        eq(userGames.userId, userId),
        inArray(userGames.status, ["backlog", "wishlist"]),
        or(isNull(userGames.playtimeMinutes), lt(userGames.playtimeMinutes, UNPLAYED_MAX_MINUTES)),
      ),
    );
  const { g, t } = await genreTagIdsByGame(rows.map((r) => r.gameId));
  return rows.map((r) => ({
    gameId: r.gameId,
    genreIds: g.get(r.gameId) ?? [],
    tagIds: t.get(r.gameId) ?? [],
    igdbRating: r.igdbRating,
    igdbRatingCount: r.igdbRatingCount,
    igdbHypes: r.igdbHypes,
    similarVotes: 0, // pas de graphe similaire pour ce bucket
  }));
}

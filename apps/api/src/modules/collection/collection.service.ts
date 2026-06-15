import {
  db,
  userGames,
  userGameStatusHistory,
  games,
  genres,
  tags,
  gameGenres,
  gameTags,
  gameSimilar,
} from "@nextquest/db";
import { and, eq, sql, inArray, desc, count } from "drizzle-orm";
import type { GameStatus, UpdateUserGameInput } from "./collection.schemas.js";
import {
  toUserGameStatusDTO,
  toCollectionItemDTO,
  toCollectionDetailDTO,
  type UserGameStatusDTO,
  type CollectionItemDTO,
  type CollectionDetailDTO,
  type GenreRef,
  type TagRef,
  type SimilarGameRef,
  type CollectionRow,
} from "./collection.dto.js";

// Champs de statut selectionnes / retournes, factorises pour rester coherents
// entre la lecture, le RETURNING et le DTO.
const STATUS_FIELDS = {
  id: userGames.id,
  status: userGames.status,
  startedAt: userGames.startedAt,
  completedAt: userGames.completedAt,
  updatedAt: userGames.updatedAt,
} as const;

// Change le statut d'un jeu de la collection de l'user.
// Renvoie null si le user_game n'existe pas ou n'appartient pas a l'user
// (la route en deduit un 404, sans distinguer les deux cas).
export async function updateGameStatus(
  userId: string,
  userGameId: string,
  newStatus: GameStatus,
): Promise<UserGameStatusDTO | null> {
  const [current] = await db
    .select(STATUS_FIELDS)
    .from(userGames)
    .where(and(eq(userGames.id, userGameId), eq(userGames.userId, userId)))
    .limit(1);

  if (!current) return null;

  // No-op : meme statut -> aucune ecriture, aucune ligne d'historique.
  if (current.status === newStatus) {
    return toUserGameStatusDTO(current);
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(userGames)
      .set({
        status: newStatus,
        updatedAt: new Date(),
        // started_at / completed_at : poses a la 1re transition seulement,
        // jamais reecrits ni vides ensuite (trace honnete pour les stats).
        ...(newStatus === "playing" && current.startedAt === null
          ? { startedAt: sql`current_date` }
          : {}),
        ...(newStatus === "completed" && current.completedAt === null
          ? { completedAt: sql`current_date` }
          : {}),
      })
      .where(eq(userGames.id, userGameId))
      .returning(STATUS_FIELDS);

    await tx.insert(userGameStatusHistory).values({
      userGameId,
      oldStatus: current.status,
      newStatus,
    });

    return toUserGameStatusDTO(updated);
  });
}

// Champs item factorises, partages entre la lecture liste, le detail et le
// rechargement apres mutation. Coherent avec le type CollectionRow du DTO.
const ITEM_FIELDS = {
  userGameId: userGames.id,
  status: userGames.status,
  playtimeMinutes: userGames.playtimeMinutes,
  rating: userGames.rating,
  review: userGames.review,
  isHidden: userGames.isHidden,
  startedAt: userGames.startedAt,
  completedAt: userGames.completedAt,
  addedAt: userGames.createdAt,
  gameId: games.id,
  title: games.title,
  slug: games.slug,
  coverUrl: games.coverUrl,
  backgroundUrl: games.backgroundUrl,
  releaseDate: games.releaseDate,
  developer: games.developer,
  publisher: games.publisher,
  igdbRating: games.igdbRating,
  igdbId: games.igdbId,
} as const;

// Genres groupes par game_id (une requete IN, assemblage en memoire). Evite N+1.
async function genresByGame(
  gameIds: string[],
): Promise<Map<string, GenreRef[]>> {
  const map = new Map<string, GenreRef[]>();
  if (gameIds.length === 0) return map;
  const rows = await db
    .select({
      gameId: gameGenres.gameId,
      id: genres.id,
      name: genres.name,
      slug: genres.slug,
    })
    .from(gameGenres)
    .innerJoin(genres, eq(gameGenres.genreId, genres.id))
    .where(inArray(gameGenres.gameId, gameIds));
  for (const r of rows) {
    const list = map.get(r.gameId) ?? [];
    list.push({ id: r.id, name: r.name, slug: r.slug });
    map.set(r.gameId, list);
  }
  return map;
}

// Tags (themes IGDB) groupes par game_id, meme principe.
async function tagsByGame(gameIds: string[]): Promise<Map<string, TagRef[]>> {
  const map = new Map<string, TagRef[]>();
  if (gameIds.length === 0) return map;
  const rows = await db
    .select({
      gameId: gameTags.gameId,
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
    })
    .from(gameTags)
    .innerJoin(tags, eq(gameTags.tagId, tags.id))
    .where(inArray(gameTags.gameId, gameIds));
  for (const r of rows) {
    const list = map.get(r.gameId) ?? [];
    list.push({ id: r.id, name: r.name, slug: r.slug });
    map.set(r.gameId, list);
  }
  return map;
}

// Liste paginee de la collection d'un user, genres/tags inline.
export async function listCollection(params: {
  userId: string;
  status?: GameStatus;
  limit: number;
  offset: number;
  includeHidden: boolean;
}): Promise<{ items: CollectionItemDTO[]; total: number }> {
  const { userId, status, limit, offset, includeHidden } = params;
  const conds = [eq(userGames.userId, userId)];
  if (status) conds.push(eq(userGames.status, status));
  if (!includeHidden) conds.push(eq(userGames.isHidden, false));
  const where = and(...conds);

  // total robuste (independant de l'offset, contrairement a count(*) OVER()).
  const [{ total }] = await db
    .select({ total: count() })
    .from(userGames)
    .where(where);
  if (total === 0) return { items: [], total: 0 };

  const rows = await db
    .select(ITEM_FIELDS)
    .from(userGames)
    .innerJoin(games, eq(userGames.gameId, games.id))
    .where(where)
    .orderBy(desc(userGames.createdAt))
    .limit(limit)
    .offset(offset);

  const ids = rows.map((r) => r.gameId);
  const [g, t] = await Promise.all([genresByGame(ids), tagsByGame(ids)]);
  const items = rows.map((r) =>
    toCollectionItemDTO(
      r as CollectionRow,
      g.get(r.gameId) ?? [],
      t.get(r.gameId) ?? [],
    ),
  );
  return { items, total };
}

// Detail d'un jeu de la collection : metadonnees completes + jeux similaires.
// Renvoie null si le jeu n'existe pas ou n'appartient pas au user (-> 404 route).
export async function getCollectionItem(
  userId: string,
  userGameId: string,
): Promise<CollectionDetailDTO | null> {
  const [row] = await db
    .select({ ...ITEM_FIELDS, description: games.description })
    .from(userGames)
    .innerJoin(games, eq(userGames.gameId, games.id))
    .where(and(eq(userGames.id, userGameId), eq(userGames.userId, userId)))
    .limit(1);
  if (!row) return null;

  const [g, t] = await Promise.all([
    genresByGame([row.gameId]),
    tagsByGame([row.gameId]),
  ]);

  // Similaires : game_similar pointe vers des igdb_id ; on ne resout que ceux
  // qu'on possede deja dans `games` (jointure games.igdbId = similarIgdbId).
  let similar: SimilarGameRef[] = [];
  if (row.igdbId !== null) {
    similar = await db
      .select({ id: games.id, title: games.title, coverUrl: games.coverUrl })
      .from(gameSimilar)
      .innerJoin(games, eq(games.igdbId, gameSimilar.similarIgdbId))
      .where(eq(gameSimilar.gameId, row.gameId));
  }

  return toCollectionDetailDTO(
    row as CollectionRow,
    g.get(row.gameId) ?? [],
    t.get(row.gameId) ?? [],
    similar,
  );
}

// Recharge un item complet (sans le detail) apres mutation.
// null si introuvable / non possede.
async function fetchItem(
  userId: string,
  userGameId: string,
): Promise<CollectionItemDTO | null> {
  const [row] = await db
    .select(ITEM_FIELDS)
    .from(userGames)
    .innerJoin(games, eq(userGames.gameId, games.id))
    .where(and(eq(userGames.id, userGameId), eq(userGames.userId, userId)))
    .limit(1);
  if (!row) return null;
  const [g, t] = await Promise.all([
    genresByGame([row.gameId]),
    tagsByGame([row.gameId]),
  ]);
  return toCollectionItemDTO(
    row as CollectionRow,
    g.get(row.gameId) ?? [],
    t.get(row.gameId) ?? [],
  );
}

// Edite les champs hors statut. On n'ecrit que les champs explicitement fournis
// (null = effacer la valeur, undefined = ne pas toucher au champ).
// Renvoie null si le jeu n'appartient pas au user.
export async function updateCollectionItem(
  userId: string,
  userGameId: string,
  input: UpdateUserGameInput,
): Promise<CollectionItemDTO | null> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (input.rating !== undefined) set.rating = input.rating;
  if (input.review !== undefined) set.review = input.review;
  if (input.playtimeMinutes !== undefined)
    set.playtimeMinutes = input.playtimeMinutes;
  if (input.isHidden !== undefined) set.isHidden = input.isHidden;

  const [updated] = await db
    .update(userGames)
    .set(set)
    .where(and(eq(userGames.id, userGameId), eq(userGames.userId, userId)))
    .returning({ id: userGames.id });
  if (!updated) return null;

  return fetchItem(userId, userGameId);
}

// Hard delete : retire le jeu de la collection. Les FK user_game_status_history /
// user_game_tags / external_achievements -> user_games sont ON DELETE CASCADE,
// l'historique et les tags du jeu partent automatiquement. Le catalogue `games`
// partage n'est pas touche. Renvoie false si rien n'a ete supprime (non possede).
export async function deleteCollectionItem(
  userId: string,
  userGameId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(userGames)
    .where(and(eq(userGames.id, userGameId), eq(userGames.userId, userId)))
    .returning({ id: userGames.id });
  return deleted.length > 0;
}

import {
  db,
  recommendations,
  games,
  genres,
  gameGenres,
} from "@nextquest/db";
import { and, eq, isNull, inArray, desc, count } from "drizzle-orm";
import type { ListRecoQuery, RECO_BUCKETS, FeedbackBody } from "./recommendations.schemas.js";
import {
  toRecommendationDTO,
  type RecommendationDTO,
  type GenreRef,
  type RecommendationRow,
} from "./recommendations.dto.js";

type RecoBucket = (typeof RECO_BUCKETS)[number];

const RECO_FIELDS = {
  id: recommendations.id,
  bucket: recommendations.bucket,
  score: recommendations.score,
  reason: recommendations.reason,
  gameId: games.id,
  title: games.title,
  slug: games.slug,
  coverUrl: games.coverUrl,
  releaseDate: games.releaseDate,
  releaseStatus: games.releaseStatus,
  igdbRating: games.igdbRating,
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

// Liste les recos d'un user, filtrables par bucket et paginees.
// Exclut les recos avec feedback (deja swipees).
export async function listRecommendations(params: {
  userId: string;
  bucket?: RecoBucket;
  limit: number;
  offset: number;
}): Promise<{ items: RecommendationDTO[]; total: number }> {
  const { userId, bucket, limit, offset } = params;
  const conds = [
    eq(recommendations.userId, userId),
    isNull(recommendations.feedback),
  ];
  if (bucket) conds.push(eq(recommendations.bucket, bucket));
  const where = and(...conds);

  // total robuste
  const [{ total }] = await db
    .select({ total: count() })
    .from(recommendations)
    .where(where);
  if (total === 0) return { items: [], total: 0 };

  const rows = await db
    .select(RECO_FIELDS)
    .from(recommendations)
    .innerJoin(games, eq(recommendations.gameId, games.id))
    .where(where)
    .orderBy(desc(recommendations.score))
    .limit(limit)
    .offset(offset);

  const gameIds = rows.map((r) => r.gameId);
  const genresMap = await genresByGame(gameIds);
  const items = rows.map((r) =>
    toRecommendationDTO(
      r as RecommendationRow,
      genresMap.get(r.gameId) ?? [],
    ),
  );
  return { items, total };
}

// Retourne les recos groupees par bucket (3 calls a listRecommendations, une par bucket).
export async function getGroupedRecommendations(
  userId: string,
  limit: number,
): Promise<{
  libraryUnplayed: RecommendationDTO[];
  discovery: RecommendationDTO[];
  upcoming: RecommendationDTO[];
}> {
  const [libraryUnplayed, discovery, upcoming] = await Promise.all([
    listRecommendations({
      userId,
      bucket: "library_unplayed",
      limit,
      offset: 0,
    }),
    listRecommendations({
      userId,
      bucket: "discovery",
      limit,
      offset: 0,
    }),
    listRecommendations({
      userId,
      bucket: "upcoming",
      limit,
      offset: 0,
    }),
  ]);

  return {
    libraryUnplayed: libraryUnplayed.items,
    discovery: discovery.items,
    upcoming: upcoming.items,
  };
}

// Enregistre le feedback utilisateur (swipe) sur une reco.
// Retourne true si la reco a ete trouvee et mise a jour, false sinon.
export async function recordFeedback(
  userId: string,
  recoId: string,
  action: FeedbackBody["action"],
): Promise<boolean> {
  const updated = await db
    .update(recommendations)
    .set({ feedback: action, feedbackAt: new Date() })
    .where(and(eq(recommendations.id, recoId), eq(recommendations.userId, userId)))
    .returning({ id: recommendations.id });
  return updated.length > 0;
}

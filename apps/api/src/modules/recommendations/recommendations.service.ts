import {
  db,
  recommendations,
  games,
  genres,
  gameGenres,
} from "@nextquest/db";
import { and, eq, isNull, inArray, desc, count, sql } from "drizzle-orm";
import type { RECO_BUCKETS, FeedbackBody } from "./recommendations.schemas.js";
import {
  toRecommendationDTO,
  type RecommendationDTO,
  type GenreRef,
  type RecommendationRow,
} from "./recommendations.dto.js";
import { replenishRecommendations } from "./replenish.js";

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

  // Tri rotation : jamais-passes d'abord (skipped_at NULL), par score ; puis les
  // passes du plus ancien au plus recent. Quand tout le pool a ete passe, le plus
  // anciennement passe revient en tete -- il revient, mais pas tout de suite.
  const rows = await db
    .select(RECO_FIELDS)
    .from(recommendations)
    .innerJoin(games, eq(recommendations.gameId, games.id))
    .where(where)
    .orderBy(sql`${recommendations.skippedAt} asc nulls first`, desc(recommendations.score))
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
// Si un bucket est vide (0 recos sans feedback), appelle replenish pour l'approvisionner.
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

  // Appliquer le replenish si un bucket est vide (refresh-when-dry)
  const bucketResults = [
    { bucket: "library_unplayed" as const, result: libraryUnplayed },
    { bucket: "discovery" as const, result: discovery },
    { bucket: "upcoming" as const, result: upcoming },
  ];
  const emptyBuckets = bucketResults.filter(({ result }) => result.total === 0);

  // Replenish les buckets vides en parallèle
  if (emptyBuckets.length > 0) {
    await Promise.all(
      emptyBuckets.map(({ bucket }) => replenishRecommendations(userId, bucket)),
    );

    // Re-query les buckets qui ont été replenish
    const refetched = await Promise.all(
      emptyBuckets.map(({ bucket }) =>
        listRecommendations({
          userId,
          bucket,
          limit,
          offset: 0,
        }),
      ),
    );

    // Mettre à jour les résultats avec les données refetch
    for (let i = 0; i < emptyBuckets.length; i++) {
      const { bucket } = emptyBuckets[i];
      const refetchedData = refetched[i];
      if (bucket === "library_unplayed") {
        Object.assign(libraryUnplayed, refetchedData);
      } else if (bucket === "discovery") {
        Object.assign(discovery, refetchedData);
      } else if (bucket === "upcoming") {
        Object.assign(upcoming, refetchedData);
      }
    }
  }

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

// Refresh : passe les recos affichees (skip) sans les decider, puis renvoie le set
// groupe a jour. 1 id = refresh d'une carte, plusieurs = refresh groupe. Ne stampe
// que les recos du user encore sans feedback (une reco deja decidee n'est pas "passable").
export async function refreshRecommendations(
  userId: string,
  skipIds: string[],
  limit: number,
): Promise<Awaited<ReturnType<typeof getGroupedRecommendations>>> {
  if (skipIds.length > 0) {
    await db
      .update(recommendations)
      .set({ skippedAt: new Date() })
      .where(
        and(
          eq(recommendations.userId, userId),
          inArray(recommendations.id, skipIds),
          isNull(recommendations.feedback),
        ),
      );
  }
  return getGroupedRecommendations(userId, limit);
}

import { db, recommendations, games, gameGenres, genres } from "@nextquest/db";
import { and, eq, isNull, inArray, sql } from "drizzle-orm";
import {
  getLibraryUnplayedCandidates,
  getDiscoveryCandidates,
  getUpcomingCandidates,
  getOwnedForProfile,
  getDimensionFrequencies,
  getSwipeDeltas,
} from "./candidates.js";
import { buildBaseProfile, applySwipeDeltas, normalize } from "./profile.js";
import { buildIdfMap } from "./idf.js";
import { scoreCandidate, type Bucket, type Candidate, type ScoreFactors } from "./scoring.js";
import { buildReason } from "./recommendations.dto.js";
import { diversify } from "./diversify.js";

const PER_BUCKET = 20;

// Construit les recos d'un bucket donné à partir de candidats bruts.
// Réutilisable par generate et replenish pour éviter la duplication.
// Prend en entrée les candidats filtrés (déjà exclus si besoin), le profil, et le bucket.
// Retourne les rows à insérer, avec raison construite (SANS userId).
type RecoWithoutUserId = Omit<typeof recommendations.$inferInsert, 'userId'>;

export async function buildBucketRecos(
  profile: Map<string, number>,
  candidates: Candidate[],
  bucket: Bucket,
): Promise<RecoWithoutUserId[]> {
  const toInsert: RecoWithoutUserId[] = [];

  if (candidates.length === 0) return toInsert;

  const maxSim = Math.max(1, ...candidates.map((c) => c.similarVotes));
  const scored = candidates
    .map((c) => ({ c, ...scoreCandidate(profile, c, bucket, maxSim) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, PER_BUCKET);

  if (scored.length === 0) return toInsert;

  // Charger les genres pour la diversification
  const scoredGameIds = scored.map((s) => s.c.gameId);
  const gameGenresRows = await db
    .select({
      gameId: gameGenres.gameId,
      genreId: gameGenres.genreId,
    })
    .from(gameGenres)
    .where(inArray(gameGenres.gameId, scoredGameIds));

  const genresByGame = new Map<string, string[]>();
  for (const row of gameGenresRows) {
    if (!genresByGame.has(row.gameId)) genresByGame.set(row.gameId, []);
    genresByGame.get(row.gameId)!.push(row.genreId);
  }

  // Trouver le genre dominant (plus grand poids dans le profil)
  const getDominantGenre = (gameId: string): string | null => {
    const genreIds = genresByGame.get(gameId) ?? [];
    if (genreIds.length === 0) return null;
    let maxWeight = -1;
    let dominant: string | null = null;
    for (const gid of genreIds) {
      const weight = profile.get(`g:${gid}`) ?? 0;
      if (weight > maxWeight) {
        maxWeight = weight;
        dominant = gid;
      }
    }
    return dominant;
  };

  // Appliquer la diversification
  const diversifiableScored = scored.map((s) => ({
    c: s.c,
    score: s.score,
    factors: s.factors,
    dominantGenreId: getDominantGenre(s.c.gameId),
  }));

  const diversified = diversify(
    diversifiableScored.map((ds) => ({
      gameId: ds.c.gameId,
      score: ds.score,
      dominantGenreId: ds.dominantGenreId,
    })),
    3,
  );

  const diversifiedScoreMap = new Map(
    diversifiableScored.map((ds) => [ds.c.gameId, { score: ds.score, factors: ds.factors }]),
  );

  for (const d of diversified) {
    const scoreInfo = diversifiedScoreMap.get(d.gameId);
    if (!scoreInfo) continue;
    toInsert.push({
      gameId: d.gameId,
      bucket,
      score: scoreInfo.score.toFixed(3),
      reason: { text: buildReason(bucket, scoreInfo.factors), factors: scoreInfo.factors },
    });
  }

  // Hydrater avec les noms de genres matchés
  if (toInsert.length > 0) {
    const insertGameIds = toInsert.map((r) => r.gameId);
    const gameGenresRowsForNames = await db
      .select({
        gameId: gameGenres.gameId,
        genreId: gameGenres.genreId,
        name: genres.name,
      })
      .from(gameGenres)
      .innerJoin(genres, eq(gameGenres.genreId, genres.id))
      .where(inArray(gameGenres.gameId, insertGameIds));

    const genresByGameForNames = new Map<string, Array<{ name: string; weight: number }>>();
    for (const row of gameGenresRowsForNames) {
      const weight = profile.get(`g:${row.genreId}`) ?? 0;
      if (weight > 0) {
        if (!genresByGameForNames.has(row.gameId))
          genresByGameForNames.set(row.gameId, []);
        genresByGameForNames.get(row.gameId)!.push({ name: row.name, weight });
      }
    }

    const matchedGenreNamesByGame = new Map<string, string[]>();
    for (const [gameId, genreList] of genresByGameForNames) {
      const sorted = genreList.sort((a, b) => b.weight - a.weight);
      matchedGenreNamesByGame.set(gameId, sorted.map((g) => g.name));
    }

    // Mettre à jour les raisons
    for (const row of toInsert) {
      const matchedNames = matchedGenreNamesByGame.get(row.gameId) ?? [];
      const reasonObj = row.reason as { text: string; factors: ScoreFactors };
      reasonObj.text = buildReason(bucket, reasonObj.factors, matchedNames);
    }
  }

  return toInsert;
}

// Réapprovisionne un bucket avec des jeux jamais recommandés au user.
// Exclut TOUS les gameId ayant déjà une reco (quel que soit le feedback).
// Insère sans supprimer l'existant (complète le deck).
// Retourne le nombre de recos insérées.
export async function replenishRecommendations(
  userId: string,
  bucket: Bucket,
): Promise<{ inserted: number }> {
  // 1. Récupérer les gameIds déjà recommandés (all feedback states)
  const alreadyRecommended = new Set(
    (
      await db
        .select({ gameId: recommendations.gameId })
        .from(recommendations)
        .where(eq(recommendations.userId, userId))
    ).map((r) => r.gameId),
  );

  // 2. Construire le profil de l'user
  const [owned, dims, swipes] = await Promise.all([
    getOwnedForProfile(userId),
    getDimensionFrequencies(),
    getSwipeDeltas(userId),
  ]);
  const idf = buildIdfMap(dims.totalGames, dims.freqs);
  const profile = normalize(applySwipeDeltas(buildBaseProfile(owned, idf), swipes));

  // 3. Récupérer les candidats du bucket et les filtrer
  let candidates: Candidate[] = [];
  if (bucket === "library_unplayed") {
    candidates = await getLibraryUnplayedCandidates(userId);
  } else if (bucket === "discovery") {
    candidates = await getDiscoveryCandidates(userId);
  } else if (bucket === "upcoming") {
    candidates = await getUpcomingCandidates(userId);
  }

  // Exclure tous les jeux déjà recommandés
  const filteredCandidates = candidates.filter((c) => !alreadyRecommended.has(c.gameId));

  // 4. Scorer, diversifier et construire les recos
  const toInsert = await buildBucketRecos(profile, filteredCandidates, bucket);

  // 5. Insérer en transaction avec verrou advisory
  const result = await db.transaction(async (tx) => {
    // Verrou pour éviter les doublons en cas de replenish concurrents
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId})::bigint)`);

    if (toInsert.length > 0) {
      await tx.insert(recommendations).values(
        toInsert.map((r) => ({
          userId,
          gameId: r.gameId,
          bucket: r.bucket,
          score: r.score,
          reason: r.reason,
        })),
      );
    }
    return { inserted: toInsert.length };
  });

  return result;
}

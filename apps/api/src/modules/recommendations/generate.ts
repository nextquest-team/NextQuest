import { db, recommendations, games, userGames, gameSimilar } from "@nextquest/db";
import { and, eq, isNull, inArray } from "drizzle-orm";
import {
  getOwnedForProfile,
  getDimensionFrequencies,
  getSwipeDeltas,
  getLibraryUnplayedCandidates,
  getDiscoveryCandidates,
} from "./candidates.js";
import { buildBaseProfile, applySwipeDeltas, normalize } from "./profile.js";
import { buildIdfMap } from "./idf.js";
import { scoreCandidate, type Bucket, type Candidate } from "./scoring.js";
import { buildReason } from "./recommendations.dto.js";
import { hydrateMissingGames } from "./hydrate.js";

const PER_BUCKET = 20; // nb de recos conservees par categorie

export async function generateRecommendations(userId: string): Promise<{ inserted: number }> {
  // 1. Profil de gout normalise (base + apprentissage swipe).
  const [owned, dims, swipes] = await Promise.all([
    getOwnedForProfile(userId),
    getDimensionFrequencies(),
    getSwipeDeltas(userId),
  ]);
  const idf = buildIdfMap(dims.totalGames, dims.freqs);
  const profile = normalize(
    applySwipeDeltas(buildBaseProfile(owned, idf), swipes),
  );

  // 2. Hydratation discovery + candidats par bucket.
  // Recuperer les igdbIds similaires des jeux possedes et hydrater les manquants.
  let similarIgdbIds: number[] = [];
  if (owned.length > 0) {
    const ownedGameIds = owned.map((o) => o.gameId);
    if (ownedGameIds.length > 0) {
      const sims = await db
        .select({ similarIgdbId: gameSimilar.similarIgdbId })
        .from(gameSimilar)
        .where(inArray(gameSimilar.gameId, ownedGameIds));
      similarIgdbIds = [...new Set(sims.map((s) => s.similarIgdbId))];
    }
    // Hydrater les igdbIds manquants avant d'appeler getDiscoveryCandidates
    if (similarIgdbIds.length > 0) {
      await hydrateMissingGames(similarIgdbIds);
    }
  }

  const buckets: { bucket: Bucket; candidates: Candidate[] }[] = [
    { bucket: "library_unplayed", candidates: await getLibraryUnplayedCandidates(userId) },
    { bucket: "discovery", candidates: await getDiscoveryCandidates(userId) },
  ];

  // 3. Score + selection top N par bucket.
  const toInsert: (typeof recommendations.$inferInsert)[] = [];
  for (const { bucket, candidates } of buckets) {
    const maxSim = Math.max(1, ...candidates.map((c) => c.similarVotes));
    const scored = candidates
      .map((c) => ({ c, ...scoreCandidate(profile, c, bucket, maxSim) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, PER_BUCKET);
    for (const s of scored) {
      toInsert.push({
        userId,
        gameId: s.c.gameId,
        bucket,
        score: s.score.toFixed(3),
        reason: { text: buildReason(bucket, s.factors), factors: s.factors },
      });
    }
  }

  // 4. Remplace les recos NON actionnees (on garde celles avec feedback : exclusion
  //    + apprentissage). Insertion en transaction.
  return db.transaction(async (tx) => {
    await tx
      .delete(recommendations)
      .where(and(eq(recommendations.userId, userId), isNull(recommendations.feedback)));
    if (toInsert.length > 0) await tx.insert(recommendations).values(toInsert);
    return { inserted: toInsert.length };
  });
}

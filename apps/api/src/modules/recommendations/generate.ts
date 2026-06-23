import { db, recommendations, games, gameSimilar, gameGenres, genres } from "@nextquest/db";
import { and, eq, isNull, inArray, sql } from "drizzle-orm";
import {
  getOwnedForProfile,
  getDimensionFrequencies,
  getSwipeDeltas,
  getLibraryUnplayedCandidates,
  getDiscoveryCandidates,
  getUpcomingCandidates,
} from "./candidates.js";
import { buildBaseProfile, applySwipeDeltas, normalize } from "./profile.js";
import { buildIdfMap } from "./idf.js";
import {
  scoreCandidate,
  type Bucket,
  type Candidate,
  type ScoreFactors,
} from "./scoring.js";
import { buildReason } from "./recommendations.dto.js";
import { hydrateMissingGames } from "./hydrate.js";

const PER_BUCKET = 20; // nb de recos conservees par categorie

// Logger injectable pour les recos. Adapte a pino et testable.
export type RecoLogger = {
  info: (obj: object, msg?: string) => void;
};

// Isolation des echecs par bucket : un echec dans une source n'empeche pas les autres buckets
async function safeCandidates(
  label: Bucket,
  fn: () => Promise<Candidate[]>,
  logger: RecoLogger,
): Promise<Candidate[]> {
  try {
    return await fn();
  } catch (err) {
    logger.info(
      { bucket: label, err: err instanceof Error ? err.message : String(err) },
      "generation candidats bucket echouee",
    );
    return [];
  }
}

// Logger par defaut ecrit en JSON structuree sur console.
const defaultRecoLogger: RecoLogger = {
  info: (obj, msg) => console.log(msg ?? "reco", JSON.stringify(obj)),
};

export async function generateRecommendations(
  userId: string,
  logger: RecoLogger = defaultRecoLogger,
): Promise<{ inserted: number }> {
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

  const buckets: { bucket: Bucket; candidates: Candidate[] }[] = await Promise.all([
    safeCandidates("library_unplayed", () => getLibraryUnplayedCandidates(userId), logger).then(
      (candidates) => ({ bucket: "library_unplayed" as const, candidates }),
    ),
    safeCandidates("discovery", () => getDiscoveryCandidates(userId), logger).then(
      (candidates) => ({ bucket: "discovery" as const, candidates }),
    ),
    safeCandidates("upcoming", () => getUpcomingCandidates(userId), logger).then(
      (candidates) => ({ bucket: "upcoming" as const, candidates }),
    ),
  ]);

  // 3. Score + selection top N par bucket.
  const toInsert: (typeof recommendations.$inferInsert)[] = [];
  const bucketCounts: Record<Bucket, number> = {
    library_unplayed: 0,
    discovery: 0,
    upcoming: 0,
  };
  const allScoredGameIds: string[] = []; // Pour charger les genres après

  for (const { bucket, candidates } of buckets) {
    const maxSim = Math.max(1, ...candidates.map((c) => c.similarVotes));
    // Les candidats sont filtrés naturellement par le scoring quality-gated :
    // un jeu de mauvaise qualité rankera bas et tombera hors top-N.
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
      allScoredGameIds.push(s.c.gameId);
      bucketCounts[bucket]++;
    }
  }

  // Charger les genres des jeux scorés et construire une map gameId -> genres matchés.
  // Un genre est "matché" s'il a un poids positif dans le profil normalisé.
  const matchedGenreNamesByGame = new Map<string, string[]>();
  if (allScoredGameIds.length > 0) {
    const gameGenresRows = await db
      .select({
        gameId: gameGenres.gameId,
        genreId: gameGenres.genreId,
        name: genres.name,
      })
      .from(gameGenres)
      .innerJoin(genres, eq(gameGenres.genreId, genres.id))
      .where(inArray(gameGenres.gameId, allScoredGameIds));

    // Grouper par gameId et filtrer par poids positif dans le profil.
    const genresByGame = new Map<string, Array<{ genreId: string; name: string; weight: number }>>();
    for (const row of gameGenresRows) {
      const weight = profile.get(`g:${row.genreId}`) ?? 0;
      if (weight > 0) {
        if (!genresByGame.has(row.gameId)) genresByGame.set(row.gameId, []);
        genresByGame.get(row.gameId)!.push({ genreId: row.genreId, name: row.name, weight });
      }
    }

    // Trier par poids décroissant et garder les noms.
    for (const [gameId, genreList] of genresByGame) {
      const sorted = genreList.sort((a, b) => b.weight - a.weight);
      matchedGenreNamesByGame.set(gameId, sorted.map((g) => g.name));
    }
  }

  // Mettre à jour les raisons avec les genres matchés.
  for (const row of toInsert) {
    const matchedNames = matchedGenreNamesByGame.get(row.gameId) ?? [];
    const reasonObj = row.reason as { text: string; factors: ScoreFactors };
    reasonObj.text = buildReason(row.bucket as Bucket, reasonObj.factors, matchedNames);
  }

  // Recuperer les titres des jeux recommandes pour le logging.
  let titleMap = new Map<string, string>();
  if (toInsert.length > 0) {
    const gameIds = toInsert.map((r) => r.gameId);
    const titlesResult = await db
      .select({ id: games.id, title: games.title })
      .from(games)
      .where(inArray(games.id, gameIds));
    titleMap = new Map(titlesResult.map((g) => [g.id, g.title]));
  }

  // Emettre les logs de recommandations individuelles.
  for (const row of toInsert) {
    const title = titleMap.get(row.gameId) ?? row.gameId;
    const reasonObj = row.reason as { text: string; factors: ScoreFactors };
    logger.info(
      {
        userId,
        bucket: row.bucket,
        gameId: row.gameId,
        title,
        score: Number(row.score),
        factors: reasonObj.factors,
        reason: reasonObj.text,
      },
      "reco generee",
    );
  }

  // 4. Remplace les recos NON actionnees (on garde celles avec feedback : exclusion
  //    + apprentissage). Insertion en transaction.
  const result = await db.transaction(async (tx) => {
    // Verrou consultatif transactionnel : empeche deux generations concurrentes
    // du meme user de creer des doublons. Le verrou est libere au COMMIT/ROLLBACK.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId})::bigint)`);

    await tx
      .delete(recommendations)
      .where(and(eq(recommendations.userId, userId), isNull(recommendations.feedback)));
    if (toInsert.length > 0) await tx.insert(recommendations).values(toInsert);
    return { inserted: toInsert.length };
  });

  // Emettre le log de synthese.
  logger.info(
    {
      userId,
      total: toInsert.length,
      parBucket: {
        library_unplayed: bucketCounts.library_unplayed,
        discovery: bucketCounts.discovery,
        upcoming: bucketCounts.upcoming,
      },
    },
    "recos generees",
  );

  return result;
}

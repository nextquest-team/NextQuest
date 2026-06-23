import {
  db,
  userGames,
  games,
  gameGenres,
  gameTags,
  recommendations,
  gameSimilar,
  genres,
} from "@nextquest/db";
import { and, eq, count, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
import type { OwnedGameForProfile, SwipeDelta } from "./profile.js";
import type { Candidate } from "./scoring.js";
import { fetchUpcomingByGenres, fetchAcclaimedByGenres } from "../games/igdb/igdb.client.js";
import { defaultDeps } from "../games/igdb/igdb.service.js";
import { hydrateMissingGames } from "./hydrate.js";
import { contentSimilarity, type GameForSimilarity } from "./similarity.js";

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

// Candidats du bucket "discovery" : jeux similaires aux jeux possedes via le graphe
// game_similar (source 1) + jeux acclaimed dans les top genres de l'user (source 2).
// La source graphe est re-classee par similarite de contenu pour filtrer le bruit.
// Les deux sources sont fusionnees, deduplicates, et exclues si deja possedes/swipes.
export async function getDiscoveryCandidates(userId: string): Promise<Candidate[]> {
  // Jeux possedes et leurs infos (igdbId, genres, developpeur, editeur, note)
  const owned = await db
    .select({
      gameId: games.id,
      igdbId: games.igdbId,
      developer: games.developer,
      publisher: games.publisher,
      igdbRating: games.igdbRating,
    })
    .from(userGames)
    .innerJoin(games, eq(userGames.gameId, games.id))
    .where(eq(userGames.userId, userId));
  const ownedGameIds = new Set(owned.map((o) => o.gameId));
  const ownedIgdbIds = owned.map((o) => o.igdbId).filter((x): x is number => x != null);
  if (ownedIgdbIds.length === 0) return [];

  // Charger les genres des jeux possedes pour filtrer les similaires par contenu
  const { g: ownedGenres, t: ownedTags } = await genreTagIdsByGame(owned.map((o) => o.gameId));
  const ownedWithContent = owned.map((o) => ({
    ...o,
    genreIds: ownedGenres.get(o.gameId) ?? [],
    tagIds: ownedTags.get(o.gameId) ?? [],
  }));

  // SOURCE 1 : graphe similaire
  const sims = await db
    .select({ ownerGameId: gameSimilar.gameId, similarIgdbId: gameSimilar.similarIgdbId })
    .from(gameSimilar)
    .where(inArray(gameSimilar.gameId, [...ownedGameIds]));

  // Re-classement : filtrer les candidats similaires par similarite de contenu
  // avec le jeu possede le plus proche. Seuil bas pour eviter de perdre des candidats.
  const SIM_CONTENT_THRESHOLD = 0.1;
  const similarVotesByIgdb = new Map<number, number>();
  for (const s of sims) {
    const ownerGame = ownedWithContent.find((o) => o.gameId === s.ownerGameId);
    if (!ownerGame) continue;

    // On aura besoin de charger le candidat pour calculer sa similarite.
    // Pour maintenant, on le note ; apres hydratation, on filtrera.
    similarVotesByIgdb.set(
      s.similarIgdbId,
      (similarVotesByIgdb.get(s.similarIgdbId) ?? 0) + 1,
    );
  }

  // SOURCE 2 : jeux acclaimed dans les top genres
  // Resoudre les top genres de l'user (comme getUpcomingCandidates)
  const genreFreq = new Map<string, number>();
  for (const owned of ownedWithContent) {
    for (const gid of owned.genreIds) {
      genreFreq.set(gid, (genreFreq.get(gid) ?? 0) + 1);
    }
  }

  const topGenreIds = [...genreFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map((e) => e[0]);

  let acclaimedByIgdb: number[] = [];
  if (topGenreIds.length > 0) {
    // Resoudre ID genres locaux -> IGDB
    const genreRows = await db
      .select({ id: genres.id, igdbId: genres.igdbId })
      .from(genres)
      .where(inArray(genres.id, topGenreIds));

    const igdbGenreIds = genreRows
      .map((r) => r.igdbId)
      .filter((x): x is number => x != null);

    if (igdbGenreIds.length > 0) {
      const nowEpoch = Math.floor(Date.now() / 1000);
      const deps = defaultDeps();
      const token = await deps.getToken();
      const clientId = process.env.TWITCH_CLIENT_ID;
      if (clientId) {
        try {
          const acclaimedGames = await fetchAcclaimedByGenres(igdbGenreIds, nowEpoch, token, clientId);
          acclaimedByIgdb = acclaimedGames.map((g) => g.igdbId);
        } catch {
          // Si l'appel IGDB echoue, continuer avec juste le graphe similaire
        }
      }
    }
  }

  // Exclusions : deja swipes
  const swiped = await db
    .select({ gameId: recommendations.gameId })
    .from(recommendations)
    .where(and(eq(recommendations.userId, userId), isNotNull(recommendations.feedback)));
  const swipedGameIds = new Set(swiped.map((s) => s.gameId));

  // Fusionner les deux sources (igdbIds)
  const allCandidateIgdbIds = new Set([
    ...[...similarVotesByIgdb.keys()],
    ...acclaimedByIgdb,
  ]);
  const candidateIgdbIds = [...allCandidateIgdbIds].filter((id) => !ownedIgdbIds.includes(id));

  if (candidateIgdbIds.length === 0) return [];

  // Resoudre igdbId -> games et charger contenu
  const resolved = await db
    .select({
      gameId: games.id,
      igdbId: games.igdbId,
      igdbRating: games.igdbRating,
      igdbRatingCount: games.igdbRatingCount,
      igdbHypes: games.igdbHypes,
      developer: games.developer,
      publisher: games.publisher,
    })
    .from(games)
    .where(inArray(games.igdbId, candidateIgdbIds));

  const { g: candidateGenres, t: candidateTags } = await genreTagIdsByGame(
    resolved.map((r) => r.gameId),
  );

  // Filtrer les candidats du graphe similaire par similarite de contenu.
  // Si peu d'info (genres manquants sur le jeu ou l'user), passer le seuil.
  const filtered = resolved.filter((r) => {
    const isFromSimilarGraph = similarVotesByIgdb.has(r.igdbId!);
    const isFromAcclaimed = acclaimedByIgdb.includes(r.igdbId!);

    // Les acclaimed passent toujours ; les similaires sont filtres
    if (isFromAcclaimed) return true;

    if (!isFromSimilarGraph) return false; // Ne devrait pas arriver ici

    // Filtrer le similaire : verifier sa similarite avec le jeu possede le plus proche
    const candidateContent: GameForSimilarity = {
      gameId: r.gameId,
      genreIds: candidateGenres.get(r.gameId) ?? [],
      themeIds: candidateTags.get(r.gameId) ?? [],
      developer: r.developer,
      publisher: r.publisher,
      igdbRating: r.igdbRating,
    };

    // Chercher le jeu possede avec lequel ce candidat a la plus haute similarite
    let maxSim = 0;
    let hasEnoughInfo = false;
    for (const ownedGame of ownedWithContent) {
      const ownedContent: GameForSimilarity = {
        gameId: ownedGame.gameId,
        genreIds: ownedGame.genreIds,
        themeIds: ownedGame.tagIds,
        developer: ownedGame.developer,
        publisher: ownedGame.publisher,
        igdbRating: ownedGame.igdbRating,
      };
      const sim = contentSimilarity(ownedContent, candidateContent);
      maxSim = Math.max(maxSim, sim);
      // Si les deux jeux ont au moins 1 genre chacun, on a suffisamment d'info
      if (ownedContent.genreIds.length > 0 && candidateContent.genreIds.length > 0) {
        hasEnoughInfo = true;
      }
    }

    // Si peu d'info (genres manquants), laisser passer. Sinon appliquer le seuil.
    if (!hasEnoughInfo) return true;
    return maxSim >= SIM_CONTENT_THRESHOLD;
  });

  return filtered
    .filter((r) => !ownedGameIds.has(r.gameId) && !swipedGameIds.has(r.gameId))
    .map((r) => ({
      gameId: r.gameId,
      genreIds: candidateGenres.get(r.gameId) ?? [],
      tagIds: candidateTags.get(r.gameId) ?? [],
      igdbRating: r.igdbRating,
      igdbRatingCount: r.igdbRatingCount,
      igdbHypes: r.igdbHypes,
      similarVotes: similarVotesByIgdb.get(r.igdbId!) ?? 0,
    }));
}

// Candidats du bucket "upcoming" : jeux pas encore sortis, dans les top genres
// de l'user, tries par hype.
export async function getUpcomingCandidates(userId: string): Promise<Candidate[]> {
  // Jeux possedes et leurs genres
  const ownedGameIds = new Set(
    (await db.select({ gameId: userGames.gameId }).from(userGames).where(eq(userGames.userId, userId))).map(
      (r) => r.gameId,
    ),
  );

  if (ownedGameIds.size === 0) return [];

  const { g } = await genreTagIdsByGame([...ownedGameIds]);

  // Frequences des genres dans les jeux possedes
  const genreFreq = new Map<string, number>();
  for (const [, genreIds] of g) {
    for (const gid of genreIds) {
      genreFreq.set(gid, (genreFreq.get(gid) ?? 0) + 1);
    }
  }

  // Top 5 genres les plus frequents, resoudre leur igdbId
  const topGenreIds = [...genreFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map((e) => e[0]);

  if (topGenreIds.length === 0) return [];

  // Resolve genre IDs to IGDB IDs from genres table
  const genreRows = await db
    .select({ id: genres.id, igdbId: genres.igdbId })
    .from(genres)
    .where(inArray(genres.id, topGenreIds));

  const igdbGenreIds = genreRows
    .map((r) => r.igdbId)
    .filter((x): x is number => x != null);

  if (igdbGenreIds.length === 0) return [];

  // Fetch upcoming games from IGDB
  const nowEpoch = Math.floor(Date.now() / 1000);
  const deps = defaultDeps();
  const token = await deps.getToken();
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) return []; // Si IGDB non disponible, ignorer ce bucket

  const upcomingGames = await fetchUpcomingByGenres(igdbGenreIds, nowEpoch, token, clientId);
  if (upcomingGames.length === 0) return [];

  // Hydrate missing games into catalog
  await hydrateMissingGames(upcomingGames.map((g) => g.igdbId));

  // Get already swiped games
  const swipedGameIds = new Set(
    (
      await db
        .select({ gameId: recommendations.gameId })
        .from(recommendations)
        .where(and(eq(recommendations.userId, userId), isNotNull(recommendations.feedback)))
    ).map((s) => s.gameId),
  );

  // Resolve IGDB IDs to games in catalog
  const resolved = await db
    .select({
      gameId: games.id,
      igdbId: games.igdbId,
      igdbRating: games.igdbRating,
      igdbRatingCount: games.igdbRatingCount,
      igdbHypes: games.igdbHypes,
    })
    .from(games)
    .where(inArray(games.igdbId, upcomingGames.map((g) => g.igdbId)));

  const { g: resolvedGenres, t: resolvedTags } = await genreTagIdsByGame(
    resolved.map((r) => r.gameId),
  );

  return resolved
    .filter((r) => !ownedGameIds.has(r.gameId) && !swipedGameIds.has(r.gameId))
    .map((r) => ({
      gameId: r.gameId,
      genreIds: resolvedGenres.get(r.gameId) ?? [],
      tagIds: resolvedTags.get(r.gameId) ?? [],
      igdbRating: r.igdbRating,
      igdbRatingCount: r.igdbRatingCount,
      igdbHypes: r.igdbHypes,
      similarVotes: 0, // pas de graphe similaire pour ce bucket
    }));
}

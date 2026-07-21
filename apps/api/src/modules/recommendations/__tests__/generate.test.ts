import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  db,
  users,
  games,
  userGames,
  gameGenres,
  gameTags,
  recommendations,
  genres,
  tags,
  platforms,
} from "@nextquest/db";
import { eq } from "drizzle-orm";
import { generateRecommendations, type RecoLogger } from "../generate.js";
import * as candidates from "../candidates.js";

// Cleanup after each test
async function cleanup() {
  await db.delete(recommendations);
  await db.delete(userGames);
  await db.delete(gameTags);
  await db.delete(gameGenres);
  await db.delete(games);
  await db.delete(users);
  await db.delete(tags);
  await db.delete(genres);
}

beforeEach(async () => {
  await cleanup();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("generateRecommendations", () => {
  it("genere une recommendation library_unplayed pour un jeu non joue de l'utilisateur", async () => {
    // Seed : user + 1 jeu joue (completed, RPG, playtime) + 1 jeu non joue (backlog, RPG, 0 min)
    const [user] = await db
      .insert(users)
      .values({
        email: "test@example.com",
        username: "testuser",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    // Genre RPG
    const [rpgGenre] = await db
      .insert(genres)
      .values({
        name: "RPG",
        slug: "rpg",
      })
      .returning({ id: genres.id });

    // Jeu joue (completed)
    const [playedGame] = await db
      .insert(games)
      .values({
        title: "Completed Game",
        slug: "completed-game",
        avgPlaytime: 100,
        isCustom: false,
      })
      .returning({ id: games.id });

    await db
      .insert(gameGenres)
      .values({
        gameId: playedGame.id,
        genreId: rpgGenre.id,
      });

    await db
      .insert(userGames)
      .values({
        userId: user.id,
        gameId: playedGame.id,
        status: "completed",
        playtimeMinutes: 150,
        rating: 8,
      });

    // Jeu non joue (backlog, 0 min)
    const [unplayedGame] = await db
      .insert(games)
      .values({
        title: "Unplayed Game",
        slug: "unplayed-game",
        avgPlaytime: 80,
        isCustom: false,
      })
      .returning({ id: games.id });

    await db
      .insert(gameGenres)
      .values({
        gameId: unplayedGame.id,
        genreId: rpgGenre.id,
      });

    await db
      .insert(userGames)
      .values({
        userId: user.id,
        gameId: unplayedGame.id,
        status: "backlog",
        playtimeMinutes: 0,
        rating: null,
      });

    // Test
    const { inserted } = await generateRecommendations(user.id);
    expect(inserted).toBeGreaterThan(0);

    const recos = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.userId, user.id));

    const libReco = recos.find((r) => r.bucket === "library_unplayed");
    expect(libReco).toBeDefined();
    expect(libReco!.gameId).toBe(unplayedGame.id);
    expect(Number(libReco!.score)).toBeGreaterThanOrEqual(0);
    expect(Number(libReco!.score)).toBeLessThanOrEqual(1);
    expect(libReco!.reason).not.toBeNull();
  });

  it("emet les logs d'explication pour chaque recommandation avec titre et facteurs", async () => {
    // Seed : user + 1 jeu joue + 1 jeu non joue pour générer une reco
    const [user] = await db
      .insert(users)
      .values({
        email: "logger-test@example.com",
        username: "loggeruser",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    const [rpgGenre] = await db
      .insert(genres)
      .values({
        name: "RPG",
        slug: "rpg",
      })
      .returning({ id: genres.id });

    const [playedGame] = await db
      .insert(games)
      .values({
        title: "Played RPG",
        slug: "played-rpg",
        avgPlaytime: 100,
        isCustom: false,
      })
      .returning({ id: games.id });

    await db
      .insert(gameGenres)
      .values({
        gameId: playedGame.id,
        genreId: rpgGenre.id,
      });

    await db
      .insert(userGames)
      .values({
        userId: user.id,
        gameId: playedGame.id,
        status: "completed",
        playtimeMinutes: 150,
        rating: 8,
      });

    const [unplayedGame] = await db
      .insert(games)
      .values({
        title: "Unplayed RPG Candidate",
        slug: "unplayed-rpg-candidate",
        avgPlaytime: 90,
        isCustom: false,
      })
      .returning({ id: games.id });

    await db
      .insert(gameGenres)
      .values({
        gameId: unplayedGame.id,
        genreId: rpgGenre.id,
      });

    await db
      .insert(userGames)
      .values({
        userId: user.id,
        gameId: unplayedGame.id,
        status: "backlog",
        playtimeMinutes: 0,
        rating: null,
      });

    // Logger fake pour capturer les appels
    const fakeLogger: RecoLogger = {
      info: vi.fn(),
    };

    const { inserted } = await generateRecommendations(user.id, fakeLogger);
    expect(inserted).toBeGreaterThan(0);

    // Verifier que logger.info a ete appelé au moins une fois avec "reco generee"
    const recoLogCalls = (fakeLogger.info as any).mock.calls.filter(
      ([_obj, msg]: [unknown, string | undefined]) => msg === "reco generee",
    );
    expect(recoLogCalls.length).toBeGreaterThan(0);

    // Verifier la structure du premier log de reco
    const [firstRecoObj] = recoLogCalls[0];
    expect(firstRecoObj).toHaveProperty("userId", user.id);
    expect(firstRecoObj).toHaveProperty("bucket");
    expect(firstRecoObj).toHaveProperty("gameId");
    expect(firstRecoObj).toHaveProperty("title");
    expect(firstRecoObj).toHaveProperty("score");
    expect(firstRecoObj).toHaveProperty("factors");
    expect(firstRecoObj).toHaveProperty("reason");
    expect(typeof firstRecoObj.score).toBe("number");
    expect(typeof firstRecoObj.reason).toBe("string");
    expect(typeof firstRecoObj.factors).toBe("object");

    // Verifier le log de synthese "recos generees"
    const summaryLogCalls = (fakeLogger.info as any).mock.calls.filter(
      ([_obj, msg]: [unknown, string | undefined]) => msg === "recos generees",
    );
    expect(summaryLogCalls.length).toBe(1);

    const [summaryObj] = summaryLogCalls[0];
    expect(summaryObj).toHaveProperty("userId", user.id);
    expect(summaryObj).toHaveProperty("total", inserted);
    expect(summaryObj).toHaveProperty("parBucket");
    expect(summaryObj.parBucket).toHaveProperty("library_unplayed");
    expect(summaryObj.parBucket).toHaveProperty("discovery");
    expect(summaryObj.parBucket).toHaveProperty("upcoming");
  });

  it("resilience : echec d'un bucket n'arrete pas les autres recommandations", async () => {
    // Seed : user + 1 jeu joue (completed, RPG) + 1 jeu non joue (backlog)
    // Objectif : verifier que si getUpcomingCandidates lance une exception,
    // generateRecommendations reussit quand meme et insere les recommandations
    // library_unplayed (qui ne depend que de la BDD locale).
    const [user] = await db
      .insert(users)
      .values({
        email: "resilience-test@example.com",
        username: "resilienceuser",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    const [rpgGenre] = await db
      .insert(genres)
      .values({
        name: "RPG",
        slug: "rpg",
      })
      .returning({ id: genres.id });

    const [playedGame] = await db
      .insert(games)
      .values({
        title: "Played Game",
        slug: "played-game",
        avgPlaytime: 100,
        isCustom: false,
      })
      .returning({ id: games.id });

    await db
      .insert(gameGenres)
      .values({
        gameId: playedGame.id,
        genreId: rpgGenre.id,
      });

    await db
      .insert(userGames)
      .values({
        userId: user.id,
        gameId: playedGame.id,
        status: "completed",
        playtimeMinutes: 150,
        rating: 8,
      });

    const [unplayedGame] = await db
      .insert(games)
      .values({
        title: "Unplayed Game",
        slug: "unplayed-game",
        avgPlaytime: 80,
        isCustom: false,
      })
      .returning({ id: games.id });

    await db
      .insert(gameGenres)
      .values({
        gameId: unplayedGame.id,
        genreId: rpgGenre.id,
      });

    await db
      .insert(userGames)
      .values({
        userId: user.id,
        gameId: unplayedGame.id,
        status: "backlog",
        playtimeMinutes: 0,
        rating: null,
      });

    // Espionner getUpcomingCandidates pour le faire lancer une erreur
    vi.spyOn(candidates, "getUpcomingCandidates").mockRejectedValueOnce(
      new Error("IGDB API unavailable"),
    );

    // Logger fake pour verifier l'appel au message d'erreur
    const fakeLogger: RecoLogger = {
      info: vi.fn(),
    };

    // L'appel doit reussir (ne pas lancer d'exception) meme avec IGDB en echec
    const { inserted } = await generateRecommendations(user.id, fakeLogger);

    // Au moins la recommendation library_unplayed doit etre inseree
    expect(inserted).toBeGreaterThan(0);

    const recos = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.userId, user.id));
    expect(recos.length).toBeGreaterThan(0);
    expect(recos.some((r) => r.bucket === "library_unplayed")).toBe(true);

    // Verifier que le logger a enregistre l'echec du bucket upcoming
    const failureLogCalls = (fakeLogger.info as any).mock.calls.filter(
      ([_obj, msg]: [unknown, string | undefined]) => msg === "generation candidats bucket echouee",
    );
    expect(failureLogCalls.length).toBeGreaterThan(0);
    expect(failureLogCalls[0][0].bucket).toBe("upcoming");
    expect(failureLogCalls[0][0].err).toContain("IGDB API unavailable");
  });

  it("discovery : qualite basse classe bas naturellement sans plancher d'exclusion", async () => {
    // Seed : user + 2 jeux reels pour tester le scoring quality-gated
    const [user] = await db
      .insert(users)
      .values({
        email: "quality-floor-test@example.com",
        username: "qualityflooruser",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    // Creer 2 jeux reels : 1 bas qualite (rankera bas), 1 bon
    const [lowQualityGame] = await db
      .insert(games)
      .values({
        title: "Low Quality Game",
        slug: "low-quality-game",
        avgPlaytime: 50,
        isCustom: false,
      })
      .returning({ id: games.id });

    const [goodQualityGame] = await db
      .insert(games)
      .values({
        title: "Good Quality Game",
        slug: "good-quality-game",
        avgPlaytime: 60,
        isCustom: false,
      })
      .returning({ id: games.id });

    // Mock pour retourner 2 candidats discovery : 1 bas qualite (rankera bas), 1 bon (rankera haut)
    const lowQualityCandidate = {
      gameId: lowQualityGame.id,
      genreIds: [],
      tagIds: [],
      igdbRating: 20, // 20/100 avec 1000 votes = quality 0.2
      igdbRatingCount: 1000,
      igdbHypes: null,
      similarVotes: 1,
      platformIds: [],
      gameType: null,
      versionParentIgdbId: null,
    };

    const goodQualityCandidate = {
      gameId: goodQualityGame.id,
      genreIds: [],
      tagIds: [],
      igdbRating: 75, // 75/100 avec 1000 votes = quality 0.75
      igdbRatingCount: 1000,
      igdbHypes: null,
      similarVotes: 1,
      platformIds: [],
      gameType: null,
      versionParentIgdbId: null,
    };

    // Espionner getDiscoveryCandidates pour retourner nos candidats
    vi.spyOn(candidates, "getDiscoveryCandidates").mockResolvedValueOnce([
      lowQualityCandidate,
      goodQualityCandidate,
    ]);

    // Pour les autres buckets, retourner des listes vides
    vi.spyOn(candidates, "getLibraryUnplayedCandidates").mockResolvedValueOnce([]);
    vi.spyOn(candidates, "getUpcomingCandidates").mockResolvedValueOnce([]);

    const fakeLogger: RecoLogger = { info: vi.fn() };

    await generateRecommendations(user.id, fakeLogger);

    // Verifier que les deux candidats sont inseres, mais le bon qualite rank plus haut
    const recos = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.userId, user.id));

    const discoveryRecos = recos.filter((r) => r.bucket === "discovery");
    expect(discoveryRecos.length).toBe(2); // Les deux candidats sont inseres
    // Verifier que le bon qualite a un meilleur score
    const lowQualityReco = discoveryRecos.find((r) => r.gameId === lowQualityGame.id);
    const goodQualityReco = discoveryRecos.find((r) => r.gameId === goodQualityGame.id);
    expect(Number(goodQualityReco!.score)).toBeGreaterThan(Number(lowQualityReco!.score));
  });

  it("filtre plateforme + DLC : exclut un candidat sur plateforme non possedee et un DLC", async () => {
    // Seed : user possedant du PC (2 jeux PC), pour que getOwnedPlatformIds detecte la plateforme
    const [user] = await db
      .insert(users)
      .values({
        email: "platform-filter-test@example.com",
        username: "platformfilteruser",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    const [pc] = await db.select({ id: platforms.id }).from(platforms).where(eq(platforms.code, "pc"));
    const [ps5] = await db.select({ id: platforms.id }).from(platforms).where(eq(platforms.code, "ps5"));

    // 2 jeux PC possedes pour prouver la possession de la plateforme (seuil >= 2)
    for (let i = 0; i < 2; i++) {
      const [ownedGame] = await db
        .insert(games)
        .values({
          title: `Owned PC Game ${i}`,
          slug: `owned-pc-game-${i}`,
          isCustom: false,
        })
        .returning({ id: games.id });
      await db
        .insert(userGames)
        .values({ userId: user.id, gameId: ownedGame.id, status: "completed", platformId: pc.id });
    }

    // Candidat A : sur PC (possede) -> doit rester
    const [pcCandidateGame] = await db
      .insert(games)
      .values({ title: "PC Candidate", slug: "pc-candidate", isCustom: false })
      .returning({ id: games.id });

    // Candidat B : uniquement sur PS5 (non possede) -> doit etre exclu
    const [ps5CandidateGame] = await db
      .insert(games)
      .values({ title: "PS5 Candidate", slug: "ps5-candidate", isCustom: false })
      .returning({ id: games.id });

    // Candidat C : DLC sur PC (possede) -> doit quand meme etre exclu (game_type)
    const [dlcCandidateGame] = await db
      .insert(games)
      .values({ title: "DLC Candidate", slug: "dlc-candidate", isCustom: false })
      .returning({ id: games.id });

    const baseCandidate = {
      genreIds: [],
      tagIds: [],
      igdbRating: 80,
      igdbRatingCount: 100,
      igdbHypes: null,
      similarVotes: 0,
    };

    vi.spyOn(candidates, "getDiscoveryCandidates").mockResolvedValueOnce([
      { ...baseCandidate, gameId: pcCandidateGame.id, platformIds: [pc.id], gameType: 0, versionParentIgdbId: null },
      { ...baseCandidate, gameId: ps5CandidateGame.id, platformIds: [ps5.id], gameType: 0, versionParentIgdbId: null },
      { ...baseCandidate, gameId: dlcCandidateGame.id, platformIds: [pc.id], gameType: 1, versionParentIgdbId: null },
    ]);
    vi.spyOn(candidates, "getLibraryUnplayedCandidates").mockResolvedValueOnce([]);
    vi.spyOn(candidates, "getUpcomingCandidates").mockResolvedValueOnce([]);

    const fakeLogger: RecoLogger = { info: vi.fn() };
    await generateRecommendations(user.id, fakeLogger);

    const recos = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.userId, user.id));

    const discoveryRecos = recos.filter((r) => r.bucket === "discovery");
    const discoveryGameIds = discoveryRecos.map((r) => r.gameId);
    expect(discoveryGameIds).toContain(pcCandidateGame.id);
    expect(discoveryGameIds).not.toContain(ps5CandidateGame.id);
    expect(discoveryGameIds).not.toContain(dlcCandidateGame.id);
  });

  it("concurrence : deux generations simultanees du meme user ne creent pas de doublons", async () => {
    // Seed : user + 1 jeu joue (pour les dimensions) + 1 jeu non joue (pour library_unplayed)
    const [user] = await db
      .insert(users)
      .values({
        email: "concurrency-test@example.com",
        username: "concurrencyuser",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    const [rpgGenre] = await db
      .insert(genres)
      .values({
        name: "RPG",
        slug: "rpg",
      })
      .returning({ id: genres.id });

    const [playedGame] = await db
      .insert(games)
      .values({
        title: "Played Game",
        slug: "played-game",
        avgPlaytime: 100,
        isCustom: false,
      })
      .returning({ id: games.id });

    await db
      .insert(gameGenres)
      .values({
        gameId: playedGame.id,
        genreId: rpgGenre.id,
      });

    await db
      .insert(userGames)
      .values({
        userId: user.id,
        gameId: playedGame.id,
        status: "completed",
        playtimeMinutes: 150,
        rating: 8,
      });

    const [unplayedGame] = await db
      .insert(games)
      .values({
        title: "Unplayed Game",
        slug: "unplayed-game",
        avgPlaytime: 80,
        isCustom: false,
      })
      .returning({ id: games.id });

    await db
      .insert(gameGenres)
      .values({
        gameId: unplayedGame.id,
        genreId: rpgGenre.id,
      });

    await db
      .insert(userGames)
      .values({
        userId: user.id,
        gameId: unplayedGame.id,
        status: "backlog",
        playtimeMinutes: 0,
        rating: null,
      });

    // Declencher deux generations simultanees pour le meme user
    const fakeLogger: RecoLogger = { info: vi.fn() };
    await Promise.all([
      generateRecommendations(user.id, fakeLogger),
      generateRecommendations(user.id, fakeLogger),
    ]);

    // Verifier qu'il n'y a PAS de doublon : chaque (userId, gameId, bucket) doit apparaitre exactement une fois
    const recos = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.userId, user.id));

    // Groupe par (gameId, bucket) et verifie que chaque combo n'apparait qu'une fois
    const groupedByGameAndBucket = new Map<string, number>();
    for (const reco of recos) {
      const key = `${reco.gameId}:${reco.bucket}`;
      groupedByGameAndBucket.set(key, (groupedByGameAndBucket.get(key) ?? 0) + 1);
    }

    // Chaque combo doit avoir une COUNT de 1
    for (const [key, count] of groupedByGameAndBucket) {
      expect(count).toBe(1, `Doublon detecte pour ${key} : count=${count}`);
    }
  });
});

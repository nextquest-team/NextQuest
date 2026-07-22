import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  db,
  users,
  games,
  userGames,
  gameGenres,
  gameTags,
  gamePlatforms,
  platforms,
  services,
  connectedServices,
  recommendations,
  genres,
  tags,
} from "@nextquest/db";
import { eq } from "drizzle-orm";
import {
  getOwnedForProfile,
  getDimensionFrequencies,
  getSwipeDeltas,
  getLibraryUnplayedCandidates,
  getDiscoveryCandidates,
  getUpcomingCandidates,
  getOwnedPlatformIds,
} from "../candidates.js";
import { gameSimilar } from "@nextquest/db";
import type { IgdbGame } from "../../games/igdb/igdb.client.js";

// Mock des dépendances IGDB
vi.mock("../../games/igdb/igdb.client.js", async () => {
  const actual = await vi.importActual<typeof import("../../games/igdb/igdb.client.js")>("../../games/igdb/igdb.client.js");
  return {
    ...actual,
    fetchUpcomingByGenres: vi.fn(),
  };
});

vi.mock("../../games/igdb/igdb.service.js", async () => {
  const actual = await vi.importActual<typeof import("../../games/igdb/igdb.service.js")>("../../games/igdb/igdb.service.js");
  return {
    ...actual,
    defaultDeps: vi.fn(() => ({
      getToken: vi.fn(async () => "test-token"),
    })),
  };
});

vi.mock("../hydrate.js", async () => {
  const actual = await vi.importActual<typeof import("../hydrate.js")>("../hydrate.js");
  return {
    ...actual,
    hydrateMissingGames: vi.fn(async () => {
      // No-op: les jeux sont déjà en DB
    }),
  };
});

// Cleanup after each test
async function cleanup() {
  await db.delete(recommendations);
  await db.delete(gameSimilar);
  await db.delete(connectedServices);
  await db.delete(userGames);
  await db.delete(gameTags);
  await db.delete(gameGenres);
  await db.delete(gamePlatforms);
  await db.delete(games);
  await db.delete(users);
  await db.delete(tags);
  await db.delete(genres);
  // platforms/services sont des donnees de reference (seedees par migration) : on ne
  // les supprime jamais, seulement les jointures/possessions crees par les tests.
}

beforeEach(async () => {
  await cleanup();
  // Configurer les variables d'environnement pour les tests.
  // getUpcomingCandidates lit TWITCH_CLIENT_ID (client IGDB via Twitch) ; sans elle,
  // la fonction court-circuite et renvoie [] -> en CI cette var n'existe pas, d'ou le stub.
  process.env.TWITCH_CLIENT_ID = "test-client-id";
});

describe("getOwnedForProfile", () => {
  it("retourne les jeux possedes avec genres, tags et duree normalise", async () => {
    // Seed : user + 1 jeu avec genre, tag, et avgPlaytime
    const [user] = await db
      .insert(users)
      .values({
        email: "test@example.com",
        username: "testuser",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    const [game] = await db
      .insert(games)
      .values({
        title: "Test Game",
        slug: "test-game",
        avgPlaytime: 120, // Duree normalise en minutes
        isCustom: false,
      })
      .returning({ id: games.id });

    // Create genre and tag records
    const [genre] = await db
      .insert(genres)
      .values({
        name: "Test Genre",
        slug: "test-genre",
      })
      .returning({ id: genres.id });

    const [tag] = await db
      .insert(tags)
      .values({
        name: "Test Tag",
        slug: "test-tag",
      })
      .returning({ id: tags.id });

    await db
      .insert(gameGenres)
      .values({
        gameId: game.id,
        genreId: genre.id,
      });

    await db
      .insert(gameTags)
      .values({
        gameId: game.id,
        tagId: tag.id,
      });

    await db
      .insert(userGames)
      .values({
        userId: user.id,
        gameId: game.id,
        status: "completed",
        playtimeMinutes: 150,
        rating: 8,
      });

    // Test
    const owned = await getOwnedForProfile(user.id);

    expect(owned).toHaveLength(1);
    expect(owned[0].gameId).toBe(game.id);
    expect(owned[0].status).toBe("completed");
    expect(owned[0].playtimeMinutes).toBe(150);
    expect(owned[0].rating).toBe(8);
    expect(owned[0].normallyMinutes).toBe(120);
    expect(owned[0].ttbCount).toBe(10); // avgPlaytime present => ttbCount = 10
    expect(owned[0].genreIds).toContain(genre.id);
    expect(owned[0].tagIds).toContain(tag.id);
  });

  it("retourne ttbCount null quand avgPlaytime est absent", async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: "test2@example.com",
        username: "testuser2",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    const [game] = await db
      .insert(games)
      .values({
        title: "Test Game No Duration",
        slug: "test-game-no-duration",
        avgPlaytime: null, // Pas de duree
        isCustom: false,
      })
      .returning({ id: games.id });

    await db
      .insert(userGames)
      .values({
        userId: user.id,
        gameId: game.id,
        status: "backlog",
      });

    const owned = await getOwnedForProfile(user.id);

    expect(owned).toHaveLength(1);
    expect(owned[0].normallyMinutes).toBeNull();
    expect(owned[0].ttbCount).toBeNull();
  });

  it("retourne tableau vide pour un user sans jeux", async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: "test3@example.com",
        username: "testuser3",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    const owned = await getOwnedForProfile(user.id);

    expect(owned).toHaveLength(0);
  });

  it("exclut les jeux ignores (excluded_at) du profil de gout", async () => {
    // Seed : user + jeu ignore (excluded_at renseigne) -> ne doit pas contribuer au profil
    const [user] = await db
      .insert(users)
      .values({
        email: "test-excluded@example.com",
        username: "testuserexcluded",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    const [game] = await db
      .insert(games)
      .values({
        title: "Ignored Game",
        slug: "ignored-game",
        isCustom: false,
      })
      .returning({ id: games.id });

    await db
      .insert(userGames)
      .values({
        userId: user.id,
        gameId: game.id,
        status: "backlog",
        excludedAt: new Date(),
      });

    const owned = await getOwnedForProfile(user.id);

    expect(owned).toHaveLength(0);
  });
});

describe("getDimensionFrequencies", () => {
  it("retourne la frequence de tous les genres et tags du catalogue", async () => {
    // Seed : 3 jeux dont 2 ont genre, 1 a tag
    const gameIds = [];
    for (let i = 0; i < 3; i++) {
      const [game] = await db
        .insert(games)
        .values({
          title: `Game ${i}`,
          slug: `game-${i}`,
          isCustom: false,
        })
        .returning({ id: games.id });
      gameIds.push(game.id);
    }

    // Create a genre and tag
    const [genre] = await db
      .insert(genres)
      .values({
        name: "Frequency Genre",
        slug: "frequency-genre",
      })
      .returning({ id: genres.id });

    const [tag] = await db
      .insert(tags)
      .values({
        name: "Frequency Tag",
        slug: "frequency-tag",
      })
      .returning({ id: tags.id });

    // 2 jeux avec le meme genre
    await db.insert(gameGenres).values([
      { gameId: gameIds[0], genreId: genre.id },
      { gameId: gameIds[1], genreId: genre.id },
    ]);

    // 1 jeu avec le meme tag
    await db
      .insert(gameTags)
      .values({ gameId: gameIds[2], tagId: tag.id });

    const freqs = await getDimensionFrequencies();

    expect(freqs.totalGames).toBe(3);
    expect(freqs.freqs).toContainEqual({ dimension: `g:${genre.id}`, freq: 2 });
    expect(freqs.freqs).toContainEqual({ dimension: `t:${tag.id}`, freq: 1 });
  });

  it("retourne totalGames=0 quand le catalogue est vide", async () => {
    const freqs = await getDimensionFrequencies();

    expect(freqs.totalGames).toBe(0);
    expect(freqs.freqs).toHaveLength(0);
  });
});

describe("getSwipeDeltas", () => {
  it("retourne les feedback avec genres et tags du jeu swipe", async () => {
    // Seed : user + jeu avec genre/tag + recommandation avec feedback
    const [user] = await db
      .insert(users)
      .values({
        email: "test4@example.com",
        username: "testuser4",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    const [game] = await db
      .insert(games)
      .values({
        title: "Swipe Game",
        slug: "swipe-game",
        isCustom: false,
      })
      .returning({ id: games.id });

    const [genre] = await db
      .insert(genres)
      .values({
        name: "Swipe Genre",
        slug: "swipe-genre",
      })
      .returning({ id: genres.id });

    const [tag] = await db
      .insert(tags)
      .values({
        name: "Swipe Tag",
        slug: "swipe-tag",
      })
      .returning({ id: tags.id });

    await db.insert(gameGenres).values({ gameId: game.id, genreId: genre.id });
    await db.insert(gameTags).values({ gameId: game.id, tagId: tag.id });

    await db
      .insert(recommendations)
      .values({
        userId: user.id,
        gameId: game.id,
        feedback: "liked",
        bucket: "discovery",
      });

    const deltas = await getSwipeDeltas(user.id);

    expect(deltas).toHaveLength(1);
    expect(deltas[0].feedback).toBe("liked");
    expect(deltas[0].genreIds).toContain(genre.id);
    expect(deltas[0].tagIds).toContain(tag.id);
  });

  it("ignore les recommandations sans feedback", async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: "test5@example.com",
        username: "testuser5",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    const [game] = await db
      .insert(games)
      .values({
        title: "No Feedback Game",
        slug: "no-feedback-game",
        isCustom: false,
      })
      .returning({ id: games.id });

    await db
      .insert(recommendations)
      .values({
        userId: user.id,
        gameId: game.id,
        feedback: null,
        bucket: "discovery",
      });

    const deltas = await getSwipeDeltas(user.id);

    expect(deltas).toHaveLength(0);
  });

  it("retourne tableau vide pour un user sans feedback", async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: "test6@example.com",
        username: "testuser6",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    const deltas = await getSwipeDeltas(user.id);

    expect(deltas).toHaveLength(0);
  });
});

describe("getOwnedPlatformIds", () => {
  it("ne compte une plateforme qu'a partir de 2 jeux", async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: "owned-platforms@example.com",
        username: "ownedplatformsuser",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    const [pc] = await db.select({ id: platforms.id }).from(platforms).where(eq(platforms.code, "pc"));
    const [switchPlatform] = await db
      .select({ id: platforms.id })
      .from(platforms)
      .where(eq(platforms.code, "switch"));

    // 3 jeux PC (plateforme reellement possedee) + 1 jeu Switch (jeu isole,
    // pas assez pour prouver la possession de la console)
    const pcGames = [];
    for (let i = 0; i < 3; i++) {
      const [game] = await db
        .insert(games)
        .values({ title: `PC Game ${i}`, slug: `pc-game-${i}`, isCustom: false })
        .returning({ id: games.id });
      pcGames.push(game);
    }
    const [switchGame] = await db
      .insert(games)
      .values({ title: "Switch Game", slug: "switch-game", isCustom: false })
      .returning({ id: games.id });

    await db.insert(userGames).values([
      ...pcGames.map((g) => ({ userId: user.id, gameId: g.id, status: "backlog" as const, platformId: pc.id })),
      { userId: user.id, gameId: switchGame.id, status: "backlog" as const, platformId: switchPlatform.id },
    ]);

    const owned = await getOwnedPlatformIds(user.id);

    expect(owned.has(pc.id)).toBe(true);
    expect(owned.has(switchPlatform.id)).toBe(false); // 1 seul jeu => pas possede
  });

  it("inclut PC si un compte Steam est lie, meme sans jeu importe sur PC", async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: "steam-linked@example.com",
        username: "steamlinkeduser",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    const [pc] = await db.select({ id: platforms.id }).from(platforms).where(eq(platforms.code, "pc"));
    const [steamService] = await db.select({ id: services.id }).from(services).where(eq(services.code, "steam"));

    await db.insert(connectedServices).values({
      userId: user.id,
      serviceId: steamService.id,
      externalUserId: "76561198000000000",
    });

    const owned = await getOwnedPlatformIds(user.id);

    expect(owned.has(pc.id)).toBe(true);
  });
});

describe("getLibraryUnplayedCandidates", () => {
  it("exclut les jeux ignores (excluded_at) de library_unplayed", async () => {
    // Seed : user + un jeu backlog playtime 0 avec excluded_at = now
    const [user] = await db
      .insert(users)
      .values({
        email: "unplayed-excluded@example.com",
        username: "unplayeduserexcluded",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    const [ignoredGame] = await db
      .insert(games)
      .values({
        title: "Ignored Backlog Game",
        slug: "ignored-backlog-game",
        isCustom: false,
      })
      .returning({ id: games.id });

    await db
      .insert(userGames)
      .values({
        userId: user.id,
        gameId: ignoredGame.id,
        status: "backlog",
        playtimeMinutes: 0,
        excludedAt: new Date(),
      });

    const cands = await getLibraryUnplayedCandidates(user.id);

    expect(cands.find((c) => c.gameId === ignoredGame.id)).toBeUndefined();
  });

  it("retourne un jeu backlog non ignore", async () => {
    // Garde-fou : le filtre excluded_at ne doit pas exclure les jeux actifs
    const [user] = await db
      .insert(users)
      .values({
        email: "unplayed-active@example.com",
        username: "unplayeduseractive",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    const [activeGame] = await db
      .insert(games)
      .values({
        title: "Active Backlog Game",
        slug: "active-backlog-game",
        isCustom: false,
      })
      .returning({ id: games.id });

    await db
      .insert(userGames)
      .values({
        userId: user.id,
        gameId: activeGame.id,
        status: "backlog",
        playtimeMinutes: 0,
      });

    const cands = await getLibraryUnplayedCandidates(user.id);

    expect(cands.find((c) => c.gameId === activeGame.id)).toBeDefined();
  });
});

describe("getDiscoveryCandidates", () => {
  it("retourne jeux similaires des jeux possedes, excluant les possedes et swipes", async () => {
    // Seed : user + jeu A (igdbId 100) avec game_similar -> igdbId 200 ;
    // jeu B (igdbId 200) deja dans games
    const [user] = await db
      .insert(users)
      .values({
        email: "discovery@example.com",
        username: "discoveryuser",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    // Jeu A possede (igdbId 100)
    const [gameA] = await db
      .insert(games)
      .values({
        title: "Game A",
        slug: "game-a",
        igdbId: 100,
        isCustom: false,
      })
      .returning({ id: games.id });

    // Jeu B (igdbId 200) - sera candidate de decouverte
    const [gameB] = await db
      .insert(games)
      .values({
        title: "Game B",
        slug: "game-b",
        igdbId: 200,
        igdbRating: 75,
        igdbRatingCount: 150,
        igdbHypes: 50,
        isCustom: false,
      })
      .returning({ id: games.id });

    // User possede A
    await db
      .insert(userGames)
      .values({
        userId: user.id,
        gameId: gameA.id,
        status: "completed",
      });

    // A est similaire a B
    await db
      .insert(gameSimilar)
      .values({
        gameId: gameA.id,
        similarIgdbId: 200,
      });

    const candidates = await getDiscoveryCandidates(user.id);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].gameId).toBe(gameB.id);
    expect(candidates[0].similarVotes).toBe(1);
    expect(candidates[0].igdbRating).toBe(75);
  });

  it("peuple platformIds a partir de game_platforms", async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: "discovery-platforms@example.com",
        username: "discoveryplatformsuser",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    const [gameA] = await db
      .insert(games)
      .values({ title: "Game A", slug: "game-a-plat", igdbId: 100, isCustom: false })
      .returning({ id: games.id });

    const [gameB] = await db
      .insert(games)
      .values({ title: "Game B", slug: "game-b-plat", igdbId: 200, isCustom: false })
      .returning({ id: games.id });

    const [pc] = await db.select({ id: platforms.id }).from(platforms).where(eq(platforms.code, "pc"));
    await db.insert(gamePlatforms).values({ gameId: gameB.id, platformId: pc.id });

    await db.insert(userGames).values({ userId: user.id, gameId: gameA.id, status: "completed" });
    await db.insert(gameSimilar).values({ gameId: gameA.id, similarIgdbId: 200 });

    const candidates = await getDiscoveryCandidates(user.id);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].platformIds).toEqual([pc.id]);
  });

  it("exclut les jeux possedes des candidats", async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: "discovery2@example.com",
        username: "discoveryuser2",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    // Deux jeux possedes
    const [gameA] = await db
      .insert(games)
      .values({
        title: "Game A",
        slug: "game-a",
        igdbId: 100,
        isCustom: false,
      })
      .returning({ id: games.id });

    const [gameC] = await db
      .insert(games)
      .values({
        title: "Game C",
        slug: "game-c",
        igdbId: 300,
        isCustom: false,
      })
      .returning({ id: games.id });

    // User possede A et C
    await db.insert(userGames).values([
      { userId: user.id, gameId: gameA.id, status: "completed" },
      { userId: user.id, gameId: gameC.id, status: "playing" },
    ]);

    // A est similaire a C (mais C est deja possede)
    await db
      .insert(gameSimilar)
      .values({
        gameId: gameA.id,
        similarIgdbId: 300,
      });

    const candidates = await getDiscoveryCandidates(user.id);

    expect(candidates).toHaveLength(0);
  });

  it("exclut les jeux deja swipes", async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: "discovery3@example.com",
        username: "discoveryuser3",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    const [gameA] = await db
      .insert(games)
      .values({
        title: "Game A",
        slug: "game-a",
        igdbId: 100,
        isCustom: false,
      })
      .returning({ id: games.id });

    const [gameB] = await db
      .insert(games)
      .values({
        title: "Game B",
        slug: "game-b",
        igdbId: 200,
        isCustom: false,
      })
      .returning({ id: games.id });

    // User possede A
    await db
      .insert(userGames)
      .values({
        userId: user.id,
        gameId: gameA.id,
        status: "completed",
      });

    // A est similaire a B
    await db
      .insert(gameSimilar)
      .values({
        gameId: gameA.id,
        similarIgdbId: 200,
      });

    // User a deja swipe sur B
    await db
      .insert(recommendations)
      .values({
        userId: user.id,
        gameId: gameB.id,
        feedback: "dismissed",
        bucket: "discovery",
      });

    const candidates = await getDiscoveryCandidates(user.id);

    expect(candidates).toHaveLength(0);
  });

  it("retourne array vide si l'user n'a pas de jeux possedes", async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: "discovery4@example.com",
        username: "discoveryuser4",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    const candidates = await getDiscoveryCandidates(user.id);

    expect(candidates).toHaveLength(0);
  });

  it("compte les votes de proximite quand plusieurs jeux possedes pointent a la meme candidate", async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: "discovery5@example.com",
        username: "discoveryuser5",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    // Deux jeux possedes A et A2
    const [gameA] = await db
      .insert(games)
      .values({
        title: "Game A",
        slug: "game-a",
        igdbId: 100,
        isCustom: false,
      })
      .returning({ id: games.id });

    const [gameA2] = await db
      .insert(games)
      .values({
        title: "Game A2",
        slug: "game-a2",
        igdbId: 101,
        isCustom: false,
      })
      .returning({ id: games.id });

    // Jeu B candidate
    const [gameB] = await db
      .insert(games)
      .values({
        title: "Game B",
        slug: "game-b",
        igdbId: 200,
        isCustom: false,
      })
      .returning({ id: games.id });

    // User possede A et A2
    await db.insert(userGames).values([
      { userId: user.id, gameId: gameA.id, status: "completed" },
      { userId: user.id, gameId: gameA2.id, status: "playing" },
    ]);

    // A et A2 pointent tous deux a B
    await db.insert(gameSimilar).values([
      { gameId: gameA.id, similarIgdbId: 200 },
      { gameId: gameA2.id, similarIgdbId: 200 },
    ]);

    const candidates = await getDiscoveryCandidates(user.id);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].gameId).toBe(gameB.id);
    expect(candidates[0].similarVotes).toBe(2);
  });

  it("ecarte de discovery un jeu a moins de 5 votes joueurs", async () => {
    // Seed : user possede A, similaire a un jeu obscur (igdbRatingCount=3)
    const [user] = await db
      .insert(users)
      .values({
        email: "discovery-floor-low@example.com",
        username: "discoveryfloorlow",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    const [gameA] = await db
      .insert(games)
      .values({ title: "Game A", slug: "game-a-floor-low", igdbId: 100, isCustom: false })
      .returning({ id: games.id });

    const [obscureGame] = await db
      .insert(games)
      .values({
        title: "Obscure Indie",
        slug: "obscure-indie-floor",
        igdbId: 200,
        igdbRatingCount: 3,
        isCustom: false,
      })
      .returning({ id: games.id });

    await db.insert(userGames).values({ userId: user.id, gameId: gameA.id, status: "completed" });
    await db.insert(gameSimilar).values({ gameId: gameA.id, similarIgdbId: 200 });

    const candidates = await getDiscoveryCandidates(user.id);

    expect(candidates.find((c) => c.gameId === obscureGame.id)).toBeUndefined();
  });

  it("garde un candidat discovery sans note du tout (igdbRatingCount null)", async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: "discovery-floor-null@example.com",
        username: "discoveryfloornull",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    const [gameA] = await db
      .insert(games)
      .values({ title: "Game A", slug: "game-a-floor-null", igdbId: 100, isCustom: false })
      .returning({ id: games.id });

    const [unratedGame] = await db
      .insert(games)
      .values({
        title: "Unrated Game",
        slug: "unrated-game-floor",
        igdbId: 200,
        igdbRatingCount: null,
        isCustom: false,
      })
      .returning({ id: games.id });

    await db.insert(userGames).values({ userId: user.id, gameId: gameA.id, status: "completed" });
    await db.insert(gameSimilar).values({ gameId: gameA.id, similarIgdbId: 200 });

    const candidates = await getDiscoveryCandidates(user.id);

    expect(candidates.find((c) => c.gameId === unratedGame.id)).toBeDefined();
  });

  it("garde un candidat discovery bien vote (igdbRatingCount=50)", async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: "discovery-floor-high@example.com",
        username: "discoveryfloorhigh",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    const [gameA] = await db
      .insert(games)
      .values({ title: "Game A", slug: "game-a-floor-high", igdbId: 100, isCustom: false })
      .returning({ id: games.id });

    const [popularGame] = await db
      .insert(games)
      .values({
        title: "Popular Game",
        slug: "popular-game-floor",
        igdbId: 200,
        igdbRatingCount: 50,
        isCustom: false,
      })
      .returning({ id: games.id });

    await db.insert(userGames).values({ userId: user.id, gameId: gameA.id, status: "completed" });
    await db.insert(gameSimilar).values({ gameId: gameA.id, similarIgdbId: 200 });

    const candidates = await getDiscoveryCandidates(user.id);

    expect(candidates.find((c) => c.gameId === popularGame.id)).toBeDefined();
  });

  it("garde-fou : un jeu possede et ignore ne redevient pas recommandable", async () => {
    // Seed : user possede A (actif) similaire a D (igdbId 400), et possede aussi D
    // lui-meme mais D est ignore. D doit rester exclu des candidats malgre l'ignore :
    // ownedGameIds/ownedIgdbIds (exclusion) ne doivent JAMAIS filtrer excluded_at.
    const [user] = await db
      .insert(users)
      .values({
        email: "discovery-guard@example.com",
        username: "discoveryguard",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    const [gameA] = await db
      .insert(games)
      .values({
        title: "Game A",
        slug: "game-a-guard",
        igdbId: 100,
        isCustom: false,
      })
      .returning({ id: games.id });

    const [gameD] = await db
      .insert(games)
      .values({
        title: "Game D",
        slug: "game-d-guard",
        igdbId: 400,
        isCustom: false,
      })
      .returning({ id: games.id });

    // User possede A (actif) et D (ignore)
    await db.insert(userGames).values([
      { userId: user.id, gameId: gameA.id, status: "completed" },
      { userId: user.id, gameId: gameD.id, status: "backlog", excludedAt: new Date() },
    ]);

    // A est similaire a D (igdbId 400) : sans le garde-fou, D pourrait remonter
    // comme candidat puisqu'il est exclu du profil (ownedActive) mais pas de
    // l'ensemble d'exclusion (ownedGameIds/ownedIgdbIds).
    await db
      .insert(gameSimilar)
      .values({
        gameId: gameA.id,
        similarIgdbId: 400,
      });

    const candidates = await getDiscoveryCandidates(user.id);

    expect(candidates.find((c) => c.gameId === gameD.id)).toBeUndefined();
  });
});

describe("getUpcomingCandidates", () => {
  it("retourne tableau vide si l'user n'a pas de jeux possedes", async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: "upcoming@example.com",
        username: "upcominguser",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    const candidates = await getUpcomingCandidates(user.id);

    expect(candidates).toHaveLength(0);
  });

  it("exclut les jeux possedes et swipes des candidats upcomings", async () => {
    // Teste la logique d'exclusion des jeux possédés et swipés.
    // Mock fetchUpcomingByGenres et defaultDeps pour éviter les appels IGDB réels.

    const { fetchUpcomingByGenres } = await import("../../games/igdb/igdb.client.js");
    const { defaultDeps } = await import("../../games/igdb/igdb.service.js");

    const [user] = await db
      .insert(users)
      .values({
        email: "upcoming2@example.com",
        username: "upcominguser2",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    // Jeu possédé avec genre Action (igdbId 10)
    const [ownedGame] = await db
      .insert(games)
      .values({
        title: "Owned Game",
        slug: "owned-game",
        igdbId: 100,
        igdbRating: 80,
        igdbRatingCount: 500,
        igdbHypes: 100,
        isCustom: false,
      })
      .returning({ id: games.id });

    const [genreRow] = await db
      .insert(genres)
      .values({
        name: "Action",
        slug: "action",
        igdbId: 10,
      })
      .returning({ id: genres.id });

    await db.insert(gameGenres).values({
      gameId: ownedGame.id,
      genreId: genreRow.id,
    });

    await db.insert(userGames).values({
      userId: user.id,
      gameId: ownedGame.id,
      status: "completed",
    });

    // Jeu swipé (déjà évalué)
    const [swipedGame] = await db
      .insert(games)
      .values({
        title: "Swiped Game",
        slug: "swiped-game",
        igdbId: 200,
        igdbRating: 75,
        igdbRatingCount: 300,
        igdbHypes: 50,
        isCustom: false,
      })
      .returning({ id: games.id });

    await db.insert(recommendations).values({
      userId: user.id,
      gameId: swipedGame.id,
      feedback: "dismissed",
      bucket: "upcoming",
    });

    // Jeu upcoming candidat (igdbId 300) avec genre Action, pas possédé, pas swipé
    const [upcomingGame] = await db
      .insert(games)
      .values({
        title: "Upcoming Game",
        slug: "upcoming-game",
        igdbId: 300,
        igdbRating: 85,
        igdbRatingCount: 200,
        igdbHypes: 120,
        isCustom: false,
      })
      .returning({ id: games.id });

    await db.insert(gameGenres).values({
      gameId: upcomingGame.id,
      genreId: genreRow.id,
    });

    // Mock fetchUpcomingByGenres pour retourner les IgdbGame correspondant aux jeux en DB
    const mockUpcomingGames: IgdbGame[] = [
      {
        igdbId: 200, // Swipé
        name: "Swiped Game",
        summary: "A swiped game",
        releaseDate: "2026-12-01",
        rating: 75,
        ratingCount: 300,
        coverImageId: null,
        artworkImageId: null,
        developer: null,
        publisher: null,
        genres: [{ igdbId: 10, name: "Action", slug: "action" }],
        themes: [],
        similarIgdbIds: [],
        hypes: 50,
        platformIds: [],
        gameType: null,
        versionParentIgdbId: null,
      },
      {
        igdbId: 300, // Upcoming candidat
        name: "Upcoming Game",
        summary: "An upcoming game",
        releaseDate: "2026-09-15",
        rating: 85,
        ratingCount: 200,
        coverImageId: null,
        artworkImageId: null,
        developer: null,
        publisher: null,
        genres: [{ igdbId: 10, name: "Action", slug: "action" }],
        themes: [],
        similarIgdbIds: [],
        hypes: 120,
        platformIds: [],
        gameType: null,
        versionParentIgdbId: null,
      },
    ];

    vi.mocked(fetchUpcomingByGenres).mockResolvedValue(mockUpcomingGames);
    vi.mocked(defaultDeps).mockReturnValue({
      getToken: vi.fn(async () => "test-token"),
    } as any);

    const candidates = await getUpcomingCandidates(user.id);

    // Le candidat upcoming devrait être retourné, les owned et swiped exclus
    expect(candidates).toHaveLength(1);
    expect(candidates[0].gameId).toBe(upcomingGame.id);
    expect(candidates[0].igdbRating).toBe(85);
    expect(candidates[0].igdbHypes).toBe(120);
    expect(candidates[0].similarVotes).toBe(0);

    // Vérifier que le jeu swiped est bien exclus (check indirect: pas dans résultats)
    const swipedInResults = candidates.some((c) => c.gameId === swipedGame.id);
    expect(swipedInResults).toBe(false);

    // Vérifier que le jeu possédé est bien exclus
    const ownedInResults = candidates.some((c) => c.gameId === ownedGame.id);
    expect(ownedInResults).toBe(false);
  });

  it("charge les imports statiques sans erreur circulaire", async () => {
    // Vérifie que candidates.ts exporte getUpcomingCandidates sans cycles d'imports.
    // Le fait que le module se charge sans erreur prouve qu'il n'y a pas de cycles.

    expect(typeof getUpcomingCandidates).toBe("function");
  });
});

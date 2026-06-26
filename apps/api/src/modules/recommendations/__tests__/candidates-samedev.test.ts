import { describe, it, expect, beforeEach, vi } from "vitest";
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
} from "@nextquest/db";
import { getDiscoveryCandidates } from "../candidates.js";
import type { IgdbGame } from "../../games/igdb/igdb.client.js";

// Mock des dépendances IGDB
vi.mock("../../games/igdb/igdb.client.js", async () => {
  const actual = await vi.importActual<typeof import("../../games/igdb/igdb.client.js")>(
    "../../games/igdb/igdb.client.js",
  );
  return {
    ...actual,
    fetchAcclaimedByGenres: vi.fn(),
    fetchGamesByDeveloper: vi.fn(),
  };
});

vi.mock("../../games/igdb/igdb.service.js", async () => {
  const actual = await vi.importActual<typeof import("../../games/igdb/igdb.service.js")>(
    "../../games/igdb/igdb.service.js",
  );
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
  process.env.TWITCH_CLIENT_ID = "test-client-id";
});

describe("getDiscoveryCandidates - source 3: mêmes studios", () => {
  it("inclut des candidats du même studio que les jeux possédés, hors possédés/swipés", async () => {
    // Seed : user + jeu Baldur's Gate 3 (Larian Studios) possédé
    // + jeu Divinity (Larian Studios) non possédé mais dans les résultats fetchGamesByDeveloper
    const [user] = await db
      .insert(users)
      .values({
        email: "samedev@example.com",
        username: "samedevuser",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    // Créer un genre RPG
    const [rpgGenre] = await db
      .insert(genres)
      .values({
        name: "RPG",
        slug: "rpg",
        igdbId: 12,
      })
      .returning({ id: genres.id });

    // Jeu A : Baldur's Gate 3 (Larian Studios, igdbId 1000)
    const [gameA] = await db
      .insert(games)
      .values({
        title: "Baldur's Gate 3",
        slug: "baldurs-gate-3",
        igdbId: 1000,
        developer: "Larian Studios",
        publisher: "Larian Studios",
        igdbRating: 92,
        igdbRatingCount: 5000,
        igdbHypes: 1000,
        isCustom: false,
      })
      .returning({ id: games.id });

    await db.insert(gameGenres).values({
      gameId: gameA.id,
      genreId: rpgGenre.id,
    });

    // User possède gameA
    await db.insert(userGames).values({
      userId: user.id,
      gameId: gameA.id,
      status: "completed",
    });

    // Jeu B : Divinity: Original Sin 2 (Larian Studios, igdbId 2000)
    // Non possédé, mais du même studio => doit être dans les candidats
    const [gameB] = await db
      .insert(games)
      .values({
        title: "Divinity: Original Sin 2",
        slug: "divinity-original-sin-2",
        igdbId: 2000,
        developer: "Larian Studios",
        publisher: "Larian Studios",
        igdbRating: 88,
        igdbRatingCount: 4000,
        igdbHypes: 800,
        isCustom: false,
      })
      .returning({ id: games.id });

    await db.insert(gameGenres).values({
      gameId: gameB.id,
      genreId: rpgGenre.id,
    });

    // Mock fetchGamesByDeveloper pour retourner Divinity quand on demande Larian Studios
    const { fetchGamesByDeveloper, fetchAcclaimedByGenres } = await import(
      "../../games/igdb/igdb.client.js"
    );
    vi.mocked(fetchGamesByDeveloper).mockImplementation(async (devName) => {
      if (devName === "Larian Studios") {
        return [
          {
            igdbId: 2000,
            name: "Divinity: Original Sin 2",
            rating: 88,
            ratingCount: 4000,
            hypes: 800,
            genres: [{ igdbId: 12, name: "RPG", slug: "rpg" }],
            themes: [],
            developer: "Larian Studios",
            publisher: "Larian Studios",
          } as IgdbGame,
        ];
      }
      return [];
    });

    // Mock fetchAcclaimedByGenres pour retourner empty (on teste la source samedev)
    vi.mocked(fetchAcclaimedByGenres).mockResolvedValue([]);

    const candidates = await getDiscoveryCandidates(user.id);

    // Vérifier que gameB (Divinity) est inclus dans les candidats
    expect(candidates.some((c) => c.gameId === gameB.id)).toBe(true);
    // Vérifier qu'aucun candidat n'est gameA (exclu car possédé)
    expect(candidates.every((c) => c.gameId !== gameA.id)).toBe(true);
  });

  it("filtre les jeux du même studio sans genre/theme commun avec le jeu possédé", async () => {
    // Seed : user + Baldur's Gate 3 (Larian, RPG) possédé
    // + Divinity (Larian, RPG) => doit être inclus (genre commun)
    // + Baldur's Fate (Larian, Racing, pas de genre commun) => doit être exclu (pas de genre/theme commun)
    const [user] = await db
      .insert(users)
      .values({
        email: "samedev-filter@example.com",
        username: "samedevfilteruser",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    const [rpgGenre] = await db
      .insert(genres)
      .values({
        name: "RPG",
        slug: "rpg",
        igdbId: 12,
      })
      .returning({ id: genres.id });

    const [racingGenre] = await db
      .insert(genres)
      .values({
        name: "Racing",
        slug: "racing",
        igdbId: 9,
      })
      .returning({ id: genres.id });

    // Jeu A : Baldur's Gate 3 (Larian Studios, RPG, igdbId 1000)
    const [gameA] = await db
      .insert(games)
      .values({
        title: "Baldur's Gate 3",
        slug: "baldurs-gate-3",
        igdbId: 1000,
        developer: "Larian Studios",
        publisher: "Larian Studios",
        igdbRating: 92,
        igdbRatingCount: 5000,
        igdbHypes: 1000,
        isCustom: false,
      })
      .returning({ id: games.id });

    await db.insert(gameGenres).values({
      gameId: gameA.id,
      genreId: rpgGenre.id,
    });

    await db.insert(userGames).values({
      userId: user.id,
      gameId: gameA.id,
      status: "completed",
    });

    // Jeu B : Divinity (Larian, RPG, igdbId 2000) => genre commun avec A => inclus
    const [gameB] = await db
      .insert(games)
      .values({
        title: "Divinity: Original Sin 2",
        slug: "divinity-original-sin-2",
        igdbId: 2000,
        developer: "Larian Studios",
        publisher: "Larian Studios",
        igdbRating: 88,
        igdbRatingCount: 4000,
        igdbHypes: 800,
        isCustom: false,
      })
      .returning({ id: games.id });

    await db.insert(gameGenres).values({
      gameId: gameB.id,
      genreId: rpgGenre.id,
    });

    // Jeu C : Baldur's Fate (Larian, Racing, igdbId 3000) => AUCUN genre commun => exclu
    const [gameC] = await db
      .insert(games)
      .values({
        title: "Baldur's Fate",
        slug: "baldurs-fate",
        igdbId: 3000,
        developer: "Larian Studios",
        publisher: "Larian Studios",
        igdbRating: 70,
        igdbRatingCount: 2000,
        igdbHypes: 300,
        isCustom: false,
      })
      .returning({ id: games.id });

    await db.insert(gameGenres).values({
      gameId: gameC.id,
      genreId: racingGenre.id,
    });

    const { fetchGamesByDeveloper, fetchAcclaimedByGenres } = await import(
      "../../games/igdb/igdb.client.js"
    );
    vi.mocked(fetchGamesByDeveloper).mockImplementation(async (devName) => {
      if (devName === "Larian Studios") {
        return [
          {
            igdbId: 2000,
            name: "Divinity: Original Sin 2",
            rating: 88,
            ratingCount: 4000,
            hypes: 800,
            genres: [{ igdbId: 12, name: "RPG", slug: "rpg" }],
            themes: [],
            developer: "Larian Studios",
            publisher: "Larian Studios",
          } as IgdbGame,
          {
            igdbId: 3000,
            name: "Baldur's Fate",
            rating: 70,
            ratingCount: 2000,
            hypes: 300,
            genres: [{ igdbId: 9, name: "Racing", slug: "racing" }],
            themes: [],
            developer: "Larian Studios",
            publisher: "Larian Studios",
          } as IgdbGame,
        ];
      }
      return [];
    });

    vi.mocked(fetchAcclaimedByGenres).mockResolvedValue([]);

    const candidates = await getDiscoveryCandidates(user.id);

    // Divinity DOIT être inclus (même studio + genre RPG commun avec BG3)
    expect(candidates.some((c) => c.gameId === gameB.id)).toBe(true);
    // Baldur's Fate NE DOIT PAS être inclus (même studio mais ZÉRO genre/theme commun)
    expect(candidates.every((c) => c.gameId !== gameC.id)).toBe(true);
  });

  it("exclut les jeux du même studio qui ont déjà été swipés", async () => {
    // Seed : user + Baldur's Gate 3 (Larian) possédé
    // + Divinity (Larian) swipé dismissed
    // + Enhanced Edition (Larian) non swipé => doit être candidat
    const [user] = await db
      .insert(users)
      .values({
        email: "samedev-swiped@example.com",
        username: "samedevswipeduser",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    const [rpgGenre] = await db
      .insert(genres)
      .values({
        name: "RPG",
        slug: "rpg",
        igdbId: 12,
      })
      .returning({ id: genres.id });

    // BG3
    const [gameA] = await db
      .insert(games)
      .values({
        title: "Baldur's Gate 3",
        slug: "baldurs-gate-3",
        igdbId: 1000,
        developer: "Larian Studios",
        publisher: "Larian Studios",
        igdbRating: 92,
        igdbRatingCount: 5000,
        igdbHypes: 1000,
        isCustom: false,
      })
      .returning({ id: games.id });

    await db.insert(gameGenres).values({
      gameId: gameA.id,
      genreId: rpgGenre.id,
    });

    await db.insert(userGames).values({
      userId: user.id,
      gameId: gameA.id,
      status: "completed",
    });

    // Divinity - swipé dismissed
    const [gameB] = await db
      .insert(games)
      .values({
        title: "Divinity: Original Sin 2",
        slug: "divinity-original-sin-2",
        igdbId: 2000,
        developer: "Larian Studios",
        publisher: "Larian Studios",
        igdbRating: 88,
        igdbRatingCount: 4000,
        igdbHypes: 800,
        isCustom: false,
      })
      .returning({ id: games.id });

    await db.insert(gameGenres).values({
      gameId: gameB.id,
      genreId: rpgGenre.id,
    });

    await db.insert(recommendations).values({
      userId: user.id,
      gameId: gameB.id,
      feedback: "dismissed",
      bucket: "discovery",
    });

    // Enhanced Edition - non swipé
    const [gameC] = await db
      .insert(games)
      .values({
        title: "Baldur's Gate 3: Enhanced Edition",
        slug: "baldurs-gate-3-enhanced",
        igdbId: 3000,
        developer: "Larian Studios",
        publisher: "Larian Studios",
        igdbRating: 93,
        igdbRatingCount: 5500,
        igdbHypes: 1100,
        isCustom: false,
      })
      .returning({ id: games.id });

    await db.insert(gameGenres).values({
      gameId: gameC.id,
      genreId: rpgGenre.id,
    });

    const { fetchGamesByDeveloper, fetchAcclaimedByGenres } = await import(
      "../../games/igdb/igdb.client.js"
    );
    vi.mocked(fetchGamesByDeveloper).mockResolvedValue([
      {
        igdbId: 2000,
        name: "Divinity: Original Sin 2",
        rating: 88,
        ratingCount: 4000,
        hypes: 800,
        genres: [{ igdbId: 12, name: "RPG", slug: "rpg" }],
        themes: [],
        developer: "Larian Studios",
        publisher: "Larian Studios",
      } as IgdbGame,
      {
        igdbId: 3000,
        name: "Baldur's Gate 3: Enhanced Edition",
        rating: 93,
        ratingCount: 5500,
        hypes: 1100,
        genres: [{ igdbId: 12, name: "RPG", slug: "rpg" }],
        themes: [],
        developer: "Larian Studios",
        publisher: "Larian Studios",
      } as IgdbGame,
    ]);

    vi.mocked(fetchAcclaimedByGenres).mockResolvedValue([]);

    const candidates = await getDiscoveryCandidates(user.id);

    // Enhanced Edition doit être inclus
    expect(candidates.some((c) => c.gameId === gameC.id)).toBe(true);
    // Divinity (swipé) ne doit pas être inclus
    expect(candidates.every((c) => c.gameId !== gameB.id)).toBe(true);
    // BG3 (possédé) ne doit pas être inclus
    expect(candidates.every((c) => c.gameId !== gameA.id)).toBe(true);
  });

  it("plafonne la contribution du même studio a 3 jeux par studio", async () => {
    // Seed : user + BG3 (Larian) possédé
    // + 6 autres jeux Larian du même studio via fetchGamesByDeveloper
    // => seul top 3 par similarité doivent être ajoutés aux candidats
    const [user] = await db
      .insert(users)
      .values({
        email: "samedev-ceiling@example.com",
        username: "samedevceiling",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    const [rpgGenre] = await db
      .insert(genres)
      .values({
        name: "RPG",
        slug: "rpg",
        igdbId: 12,
      })
      .returning({ id: genres.id });

    const [adventureGenre] = await db
      .insert(genres)
      .values({
        name: "Adventure",
        slug: "adventure",
        igdbId: 5,
      })
      .returning({ id: genres.id });

    // BG3 possédé (Larian, RPG + Adventure)
    const [gameA] = await db
      .insert(games)
      .values({
        title: "Baldur's Gate 3",
        slug: "baldurs-gate-3",
        igdbId: 1000,
        developer: "Larian Studios",
        publisher: "Larian Studios",
        igdbRating: 92,
        igdbRatingCount: 5000,
        igdbHypes: 1000,
        isCustom: false,
      })
      .returning({ id: games.id });

    await db.insert(gameGenres).values([
      { gameId: gameA.id, genreId: rpgGenre.id },
      { gameId: gameA.id, genreId: adventureGenre.id },
    ]);

    await db.insert(userGames).values({
      userId: user.id,
      gameId: gameA.id,
      status: "completed",
    });

    // Créer 6 jeux Larian candidates non possédés avec genres communs
    const liarianCandidates = [];
    for (let i = 0; i < 6; i++) {
      const [game] = await db
        .insert(games)
        .values({
          title: `Larian Game ${i + 1}`,
          slug: `larian-game-${i + 1}`,
          igdbId: 2000 + i,
          developer: "Larian Studios",
          publisher: "Larian Studios",
          igdbRating: 85 - i,
          igdbRatingCount: 3000,
          igdbHypes: 500,
          isCustom: false,
        })
        .returning({ id: games.id });

      await db.insert(gameGenres).values({
        gameId: game.id,
        genreId: rpgGenre.id,
      });

      liarianCandidates.push(game);
    }

    const { fetchGamesByDeveloper, fetchAcclaimedByGenres } = await import(
      "../../games/igdb/igdb.client.js"
    );

    // Mock fetchGamesByDeveloper pour retourner tous les jeux Larian (6 candidates)
    vi.mocked(fetchGamesByDeveloper).mockImplementation(async (devName) => {
      if (devName === "Larian Studios") {
        return [
          {
            igdbId: 2000,
            name: "Larian Game 1",
            rating: 85,
            ratingCount: 3000,
            hypes: 500,
            genres: [{ igdbId: 12, name: "RPG", slug: "rpg" }],
            themes: [],
            developer: "Larian Studios",
            publisher: "Larian Studios",
          } as IgdbGame,
          {
            igdbId: 2001,
            name: "Larian Game 2",
            rating: 84,
            ratingCount: 3000,
            hypes: 500,
            genres: [{ igdbId: 12, name: "RPG", slug: "rpg" }],
            themes: [],
            developer: "Larian Studios",
            publisher: "Larian Studios",
          } as IgdbGame,
          {
            igdbId: 2002,
            name: "Larian Game 3",
            rating: 83,
            ratingCount: 3000,
            hypes: 500,
            genres: [{ igdbId: 12, name: "RPG", slug: "rpg" }],
            themes: [],
            developer: "Larian Studios",
            publisher: "Larian Studios",
          } as IgdbGame,
          {
            igdbId: 2003,
            name: "Larian Game 4",
            rating: 82,
            ratingCount: 3000,
            hypes: 500,
            genres: [{ igdbId: 12, name: "RPG", slug: "rpg" }],
            themes: [],
            developer: "Larian Studios",
            publisher: "Larian Studios",
          } as IgdbGame,
          {
            igdbId: 2004,
            name: "Larian Game 5",
            rating: 81,
            ratingCount: 3000,
            hypes: 500,
            genres: [{ igdbId: 12, name: "RPG", slug: "rpg" }],
            themes: [],
            developer: "Larian Studios",
            publisher: "Larian Studios",
          } as IgdbGame,
          {
            igdbId: 2005,
            name: "Larian Game 6",
            rating: 80,
            ratingCount: 3000,
            hypes: 500,
            genres: [{ igdbId: 12, name: "RPG", slug: "rpg" }],
            themes: [],
            developer: "Larian Studios",
            publisher: "Larian Studios",
          } as IgdbGame,
        ];
      }
      return [];
    });

    vi.mocked(fetchAcclaimedByGenres).mockResolvedValue([]);

    const candidates = await getDiscoveryCandidates(user.id);

    // Compter les candidats issus de Larian (comparant les gameIds)
    const liarianCandidatesCount = candidates.filter((c) =>
      liarianCandidates.some((lg) => lg.id === c.gameId),
    ).length;

    // Maximum 3 jeux du studio Larian doivent etre dans les candidats discovery
    expect(liarianCandidatesCount).toBeLessThanOrEqual(3);
  });
});

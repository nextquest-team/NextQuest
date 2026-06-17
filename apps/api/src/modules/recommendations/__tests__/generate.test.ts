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
import { eq } from "drizzle-orm";
import { generateRecommendations, type RecoLogger } from "../generate.js";

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
      ([obj, msg]: [any, string | undefined]) => msg === "reco generee",
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
      ([obj, msg]: [any, string | undefined]) => msg === "recos generees",
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
});

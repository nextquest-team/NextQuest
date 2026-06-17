import { describe, it, expect, beforeEach } from "vitest";
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
import { generateRecommendations } from "../generate.js";

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
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  db,
  users,
  games,
  userGames,
  gameGenres,
  recommendations,
  genres,
} from "@nextquest/db";
import { eq } from "drizzle-orm";
import { replenishRecommendations } from "../replenish.js";
import * as candidates from "../candidates.js";

async function cleanup() {
  await db.delete(recommendations);
  await db.delete(userGames);
  await db.delete(gameGenres);
  await db.delete(games);
  await db.delete(users);
  await db.delete(genres);
}

beforeEach(async () => {
  await cleanup();
});

afterEach(async () => {
  await cleanup();
});

describe("replenishRecommendations", () => {
  it("n'insère que des jeux jamais recommandés à l'user (library_unplayed)", async () => {
    // Seed: user avec des recos library_unplayed toutes dismissed
    const [user] = await db
      .insert(users)
      .values({
        email: "test@example.com",
        username: "testuser",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    // Genre
    const [rpgGenre] = await db
      .insert(genres)
      .values({
        name: "RPG",
        slug: "rpg",
      })
      .returning({ id: genres.id });

    // Jeu joué (owned, pour construire profil)
    const [ownedGame] = await db
      .insert(games)
      .values({
        title: "Owned Game",
        slug: "owned-game",
        avgPlaytime: 100,
        isCustom: false,
      })
      .returning({ id: games.id });

    await db.insert(gameGenres).values({
      gameId: ownedGame.id,
      genreId: rpgGenre.id,
    });

    await db.insert(userGames).values({
      userId: user.id,
      gameId: ownedGame.id,
      status: "completed",
      playtimeMinutes: 150,
      rating: 8,
    });

    // Jeux A et B : dans la biblio mais dismissed avant replenish
    const [gameA] = await db
      .insert(games)
      .values({
        title: "Game A",
        slug: "game-a",
        avgPlaytime: 80,
        isCustom: false,
      })
      .returning({ id: games.id });

    await db.insert(gameGenres).values({
      gameId: gameA.id,
      genreId: rpgGenre.id,
    });

    const [gameB] = await db
      .insert(games)
      .values({
        title: "Game B",
        slug: "game-b",
        avgPlaytime: 90,
        isCustom: false,
      })
      .returning({ id: games.id });

    await db.insert(gameGenres).values({
      gameId: gameB.id,
      genreId: rpgGenre.id,
    });

    // Ajouter A et B dans la biblio avec backlog (=> candidats potential)
    await db.insert(userGames).values([
      {
        userId: user.id,
        gameId: gameA.id,
        status: "backlog",
        playtimeMinutes: 0,
        rating: null,
      },
      {
        userId: user.id,
        gameId: gameB.id,
        status: "backlog",
        playtimeMinutes: 5, // < 30 min, donc candidat
        rating: null,
      },
    ]);

    // Insérer des recos pour A et B avec feedback dismissed
    await db.insert(recommendations).values([
      {
        userId: user.id,
        gameId: gameA.id,
        bucket: "library_unplayed",
        score: "7.5",
        feedback: "dismissed",
        reason: { text: "test", factors: { matchG: 0.5, matchT: 0, quality: 0.5, sim: 0 } },
      },
      {
        userId: user.id,
        gameId: gameB.id,
        bucket: "library_unplayed",
        score: "7.0",
        feedback: "dismissed",
        reason: { text: "test", factors: { matchG: 0.5, matchT: 0, quality: 0.5, sim: 0 } },
      },
    ]);

    // Candidats neufs: C et D, dans la biblio avec backlog, jamais recommandés
    const [gameC] = await db
      .insert(games)
      .values({
        title: "Game C",
        slug: "game-c",
        avgPlaytime: 70,
        isCustom: false,
        igdbRating: 75,
        igdbRatingCount: 500,
      })
      .returning({ id: games.id });

    await db.insert(gameGenres).values({
      gameId: gameC.id,
      genreId: rpgGenre.id,
    });

    const [gameD] = await db
      .insert(games)
      .values({
        title: "Game D",
        slug: "game-d",
        avgPlaytime: 85,
        isCustom: false,
        igdbRating: 80,
        igdbRatingCount: 600,
      })
      .returning({ id: games.id });

    await db.insert(gameGenres).values({
      gameId: gameD.id,
      genreId: rpgGenre.id,
    });

    await db.insert(userGames).values([
      {
        userId: user.id,
        gameId: gameC.id,
        status: "backlog",
        playtimeMinutes: 0,
        rating: null,
      },
      {
        userId: user.id,
        gameId: gameD.id,
        status: "backlog",
        playtimeMinutes: 15,
        rating: null,
      },
    ]);

    // Avant: recos existantes pour A et B
    const beforeInsert = await db
      .select({ gameId: recommendations.gameId })
      .from(recommendations)
      .where(eq(recommendations.userId, user.id));

    expect(beforeInsert.map((r) => r.gameId).sort()).toEqual([gameA.id, gameB.id].sort());

    // Appeler replenish
    const result = await replenishRecommendations(user.id, "library_unplayed");

    // Après: vérifier que les nouvelles recos n'incluent pas A et B
    const afterInsert = await db
      .select({ gameId: recommendations.gameId, feedback: recommendations.feedback })
      .from(recommendations)
      .where(eq(recommendations.userId, user.id));

    const newRecos = afterInsert.filter((r) => r.feedback === null);
    const newGameIds = newRecos.map((r) => r.gameId);

    expect(result.inserted).toBeGreaterThan(0);
    expect(newGameIds).not.toContain(gameA.id);
    expect(newGameIds).not.toContain(gameB.id);
    expect(newGameIds.length).toBeGreaterThan(0);
  });

  it("ne ressuscite jamais un jeu dismissed", async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: "test2@example.com",
        username: "testuser2",
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

    // Jeu joué
    const [ownedGame] = await db
      .insert(games)
      .values({
        title: "Owned",
        slug: "owned",
        avgPlaytime: 100,
        isCustom: false,
      })
      .returning({ id: games.id });

    await db.insert(gameGenres).values({
      gameId: ownedGame.id,
      genreId: rpgGenre.id,
    });

    await db.insert(userGames).values({
      userId: user.id,
      gameId: ownedGame.id,
      status: "completed",
      playtimeMinutes: 100,
      rating: 7,
    });

    // Jeu dismissed
    const [dismissedGame] = await db
      .insert(games)
      .values({
        title: "Dismissed",
        slug: "dismissed",
        avgPlaytime: 90,
        isCustom: false,
      })
      .returning({ id: games.id });

    await db.insert(gameGenres).values({
      gameId: dismissedGame.id,
      genreId: rpgGenre.id,
    });

    await db.insert(recommendations).values({
      userId: user.id,
      gameId: dismissedGame.id,
      bucket: "discovery",
      score: "7.0",
      feedback: "dismissed",
      reason: { text: "test", factors: { matchG: 0.5, matchT: 0, quality: 0.5, sim: 0 } },
    });

    // Appeler replenish
    await replenishRecommendations(user.id, "discovery");

    // Vérifier que le dismissed garde feedback != null
    const dismissedReco = await db
      .select({ feedback: recommendations.feedback })
      .from(recommendations)
      .where(eq(recommendations.gameId, dismissedGame.id));

    expect(dismissedReco.length).toBe(1);
    expect(dismissedReco[0]!.feedback).toBe("dismissed");
  });
});

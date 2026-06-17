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
import {
  getOwnedForProfile,
  getDimensionFrequencies,
  getSwipeDeltas,
} from "../candidates.js";

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

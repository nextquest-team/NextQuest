import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import { db, users, games, recommendations, gameGenres, genres, userGames } from "@nextquest/db";
import { eq } from "drizzle-orm";
import { validatorCompiler } from "fastify-type-provider-zod";
import { registerJwt } from "../../../plugins/jwt.js";
import { registerErrorHandler } from "../../../lib/error-handler.js";
import { registerSwagger } from "../../../plugins/swagger.js";
import { recommendationsRoutes } from "../recommendations.routes.js";

async function buildApp() {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  registerErrorHandler(app);
  await registerSwagger(app);
  await registerJwt(app);
  await app.register(recommendationsRoutes, { prefix: "/api" });
  await app.ready();
  return app;
}

async function cleanup() {
  await db.delete(recommendations);
  await db.delete(userGames);
  await db.delete(gameGenres);
  await db.delete(genres);
  await db.delete(games);
  await db.delete(users);
}

async function seedRecommendations() {
  // Seed user
  const [u] = await db
    .insert(users)
    .values({
      email: "reco-route@test.com",
      username: "recoproute",
      passwordHash: "x",
    })
    .returning({ id: users.id });

  // Seed games
  const [g1] = await db
    .insert(games)
    .values({ title: "Game 1", slug: "game-1" })
    .returning({ id: games.id });
  const [g2] = await db
    .insert(games)
    .values({ title: "Game 2", slug: "game-2" })
    .returning({ id: games.id });
  const [g3] = await db
    .insert(games)
    .values({ title: "Game 3", slug: "game-3" })
    .returning({ id: games.id });

  // Seed genres
  const [gen1] = await db
    .insert(genres)
    .values({ name: "Action", slug: "action" })
    .returning({ id: genres.id });

  await db.insert(gameGenres).values([
    { gameId: g1.id, genreId: gen1.id },
    { gameId: g2.id, genreId: gen1.id },
    { gameId: g3.id, genreId: gen1.id },
  ]);

  // Seed recommendations (some with feedback, some without)
  await db
    .insert(recommendations)
    .values({
      userId: u.id,
      gameId: g1.id,
      bucket: "library_unplayed",
      score: "0.95",
      reason: { text: "Test reason 1", factors: { matchG: 0.8 } },
      feedback: null,
    });

  await db
    .insert(recommendations)
    .values({
      userId: u.id,
      gameId: g2.id,
      bucket: "discovery",
      score: "0.85",
      reason: { text: "Test reason 2", factors: { matchG: 0.7 } },
      feedback: null,
    });

  await db
    .insert(recommendations)
    .values({
      userId: u.id,
      gameId: g3.id,
      bucket: "upcoming",
      score: "0.75",
      reason: { text: "Test reason 3", factors: { matchG: 0.6 } },
      feedback: null,
    });

  // Add one with feedback (should be filtered out)
  await db.insert(recommendations).values({
    userId: u.id,
    gameId: g1.id,
    bucket: "discovery",
    score: "0.80",
    reason: { text: "Already swiped", factors: {} },
    feedback: "liked",
  });

  return { userId: u.id };
}

beforeEach(cleanup);

describe("GET /api/recommendations", () => {
  it("renvoie 401 sans JWT", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/recommendations",
    });
    expect(res.statusCode).toBe(401);
  });

  it("groupe par bucket sans parametre", async () => {
    const app = await buildApp();
    const { userId } = await seedRecommendations();
    const token = app.jwt.sign({ sub: userId });
    const res = await app.inject({
      method: "GET",
      url: "/api/recommendations",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("libraryUnplayed");
    expect(body).toHaveProperty("discovery");
    expect(body).toHaveProperty("upcoming");
    expect(Array.isArray(body.libraryUnplayed)).toBe(true);
    expect(Array.isArray(body.discovery)).toBe(true);
    expect(Array.isArray(body.upcoming)).toBe(true);
    // Verify swiped recos are filtered out
    expect(body.discovery.length).toBe(1);
  });

  it("filtre par bucket et pagine", async () => {
    const app = await buildApp();
    const { userId } = await seedRecommendations();
    const token = app.jwt.sign({ sub: userId });
    const res = await app.inject({
      method: "GET",
      url: "/api/recommendations?bucket=discovery&limit=5",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("items");
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("limit");
    expect(body).toHaveProperty("offset");
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.limit).toBe(5);
    expect(body.offset).toBe(0);
  });

  it("retourne les recos en ordre decroissant de score", async () => {
    const app = await buildApp();
    const { userId } = await seedRecommendations();
    const token = app.jwt.sign({ sub: userId });
    const res = await app.inject({
      method: "GET",
      url: "/api/recommendations?bucket=discovery",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items.length).toBeGreaterThan(0);
    // Score should be numeric and in descending order
    if (body.items.length > 1) {
      for (let i = 0; i < body.items.length - 1; i++) {
        expect(body.items[i].score).toBeGreaterThanOrEqual(body.items[i + 1].score);
      }
    }
  });

  it("exclut les recos avec feedback", async () => {
    const app = await buildApp();
    const { userId } = await seedRecommendations();
    const token = app.jwt.sign({ sub: userId });

    // Grouped response
    const groupRes = await app.inject({
      method: "GET",
      url: "/api/recommendations",
      headers: { authorization: `Bearer ${token}` },
    });
    const groupBody = groupRes.json();
    const discoveryItems = groupBody.discovery;

    // There should be 1 unswipped reco in discovery (the one with feedback should be filtered)
    expect(discoveryItems.length).toBe(1);
    expect(discoveryItems[0].reason.text).toBe("Test reason 2");
  });

  it("retourne la structure complete avec game et genres", async () => {
    const app = await buildApp();
    const { userId } = await seedRecommendations();
    const token = app.jwt.sign({ sub: userId });
    const res = await app.inject({
      method: "GET",
      url: "/api/recommendations?bucket=library_unplayed",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items.length).toBeGreaterThan(0);
    const item = body.items[0];
    expect(item).toHaveProperty("id");
    expect(item).toHaveProperty("bucket");
    expect(item).toHaveProperty("score");
    expect(item).toHaveProperty("reason");
    expect(item).toHaveProperty("game");
    expect(item.game).toHaveProperty("id");
    expect(item.game).toHaveProperty("title");
    expect(item.game).toHaveProperty("slug");
    expect(item.game).toHaveProperty("coverUrl");
    expect(item.game).toHaveProperty("releaseDate");
    expect(item.game).toHaveProperty("releaseStatus");
    expect(item.game).toHaveProperty("igdbRating");
    expect(item.game).toHaveProperty("genres");
    expect(Array.isArray(item.game.genres)).toBe(true);
  });
});

describe("POST /api/recommendations/:id/feedback", () => {
  it("renvoie 401 sans JWT", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/recommendations/550e8400-e29b-41d4-a716-446655440000/feedback",
      payload: { action: "dismissed" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("renvoie 404 si la reco n'existe pas", async () => {
    const app = await buildApp();
    const { userId } = await seedRecommendations();
    const token = app.jwt.sign({ sub: userId });
    const fakeRecoId = "550e8400-e29b-41d4-a716-446655440000";
    const res = await app.inject({
      method: "POST",
      url: `/api/recommendations/${fakeRecoId}/feedback`,
      headers: { authorization: `Bearer ${token}` },
      payload: { action: "dismissed" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Recommandation introuvable");
  });

  it("renvoie 404 si la reco appartient a un autre user", async () => {
    const app = await buildApp();
    const { userId } = await seedRecommendations();
    const token = app.jwt.sign({ sub: userId });

    // Seed another user and their reco
    const [otherUser] = await db
      .insert(users)
      .values({
        email: "other@test.com",
        username: "otheruser",
        passwordHash: "x",
      })
      .returning({ id: users.id });

    const [game] = await db
      .insert(games)
      .values({ title: "Other Game", slug: "other-game" })
      .returning({ id: games.id });

    const [otherReco] = await db
      .insert(recommendations)
      .values({
        userId: otherUser.id,
        gameId: game.id,
        bucket: "discovery",
        score: "0.8",
        reason: { text: "Other user's reco", factors: {} },
        feedback: null,
      })
      .returning({ id: recommendations.id });

    const res = await app.inject({
      method: "POST",
      url: `/api/recommendations/${otherReco.id}/feedback`,
      headers: { authorization: `Bearer ${token}` },
      payload: { action: "dismissed" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("enregistre le feedback et le rend invisible ensuite", async () => {
    const app = await buildApp();
    const { userId } = await seedRecommendations();
    const token = app.jwt.sign({ sub: userId });

    // Get reco list first to find one
    const listRes = await app.inject({
      method: "GET",
      url: "/api/recommendations?bucket=discovery",
      headers: { authorization: `Bearer ${token}` },
    });
    const listBody = listRes.json();
    expect(listBody.items.length).toBeGreaterThan(0);
    const recoId = listBody.items[0].id;

    // Record feedback
    const feedbackRes = await app.inject({
      method: "POST",
      url: `/api/recommendations/${recoId}/feedback`,
      headers: { authorization: `Bearer ${token}` },
      payload: { action: "dismissed" },
    });
    expect(feedbackRes.statusCode).toBe(200);
    expect(feedbackRes.json()).toEqual({ ok: true });

    // Verify reco no longer appears in list
    const listRes2 = await app.inject({
      method: "GET",
      url: "/api/recommendations?bucket=discovery",
      headers: { authorization: `Bearer ${token}` },
    });
    const listBody2 = listRes2.json();
    expect(listBody2.items.find((i: any) => i.id === recoId)).toBeUndefined();
  });

  it("accepte les actions liked, dismissed et added", async () => {
    const app = await buildApp();
    const { userId } = await seedRecommendations();
    const token = app.jwt.sign({ sub: userId });

    // Seed 3 recos for testing each action
    const [game1] = await db
      .insert(games)
      .values({ title: "Test Game 1", slug: "test-game-1" })
      .returning({ id: games.id });
    const [game2] = await db
      .insert(games)
      .values({ title: "Test Game 2", slug: "test-game-2" })
      .returning({ id: games.id });
    const [game3] = await db
      .insert(games)
      .values({ title: "Test Game 3", slug: "test-game-3" })
      .returning({ id: games.id });

    const [reco1] = await db
      .insert(recommendations)
      .values({
        userId,
        gameId: game1.id,
        bucket: "discovery",
        score: "0.9",
        reason: { text: "Test", factors: {} },
        feedback: null,
      })
      .returning({ id: recommendations.id });

    const [reco2] = await db
      .insert(recommendations)
      .values({
        userId,
        gameId: game2.id,
        bucket: "discovery",
        score: "0.9",
        reason: { text: "Test", factors: {} },
        feedback: null,
      })
      .returning({ id: recommendations.id });

    const [reco3] = await db
      .insert(recommendations)
      .values({
        userId,
        gameId: game3.id,
        bucket: "discovery",
        score: "0.9",
        reason: { text: "Test", factors: {} },
        feedback: null,
      })
      .returning({ id: recommendations.id });

    // Test "liked"
    const res1 = await app.inject({
      method: "POST",
      url: `/api/recommendations/${reco1.id}/feedback`,
      headers: { authorization: `Bearer ${token}` },
      payload: { action: "liked" },
    });
    expect(res1.statusCode).toBe(200);

    // Test "dismissed"
    const res2 = await app.inject({
      method: "POST",
      url: `/api/recommendations/${reco2.id}/feedback`,
      headers: { authorization: `Bearer ${token}` },
      payload: { action: "dismissed" },
    });
    expect(res2.statusCode).toBe(200);

    // Test "added"
    const res3 = await app.inject({
      method: "POST",
      url: `/api/recommendations/${reco3.id}/feedback`,
      headers: { authorization: `Bearer ${token}` },
      payload: { action: "added" },
    });
    expect(res3.statusCode).toBe(200);
  });

  it("persiste le feedback en base avec timestamp", async () => {
    const app = await buildApp();
    const { userId } = await seedRecommendations();
    const token = app.jwt.sign({ sub: userId });

    // Get a reco
    const listRes = await app.inject({
      method: "GET",
      url: "/api/recommendations?bucket=library_unplayed",
      headers: { authorization: `Bearer ${token}` },
    });
    const recoId = listRes.json().items[0].id;

    // Record feedback
    const before = new Date();
    await app.inject({
      method: "POST",
      url: `/api/recommendations/${recoId}/feedback`,
      headers: { authorization: `Bearer ${token}` },
      payload: { action: "liked" },
    });
    const after = new Date();

    // Verify in database
    const updated = await db.query.recommendations.findFirst({
      where: (t) => eq(t.id, recoId),
    });
    expect(updated?.feedback).toBe("liked");
    expect(updated?.feedbackAt).not.toBeNull();
    const feedbackTime = new Date(updated!.feedbackAt!).getTime();
    expect(feedbackTime).toBeGreaterThanOrEqual(before.getTime());
    expect(feedbackTime).toBeLessThanOrEqual(after.getTime());
  });
});

describe("POST /api/recommendations/generate", () => {
  it("renvoie 401 sans JWT", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/recommendations/generate",
    });
    expect(res.statusCode).toBe(401);
  });

  it("genere des recos pour l'user courant", async () => {
    const app = await buildApp();

    // Seed user
    const [user] = await db
      .insert(users)
      .values({
        email: "generate-reco@test.com",
        username: "generatereco",
        passwordHash: "x",
      })
      .returning({ id: users.id });

    // Seed un jeu pour avoir au moins du contenu
    const [game] = await db
      .insert(games)
      .values({ title: "Test Game", slug: "test-game" })
      .returning({ id: games.id });

    // Seed genre pour enrichir le jeu
    const [genre] = await db
      .insert(genres)
      .values({ name: "Action", slug: "action" })
      .returning({ id: genres.id });

    await db.insert(gameGenres).values({
      gameId: game.id,
      genreId: genre.id,
    });

    // Ajouter le jeu a la bibliotheque (backlog par defaut)
    await db.insert(userGames).values({
      userId: user.id,
      gameId: game.id,
      status: "backlog",
    });

    const token = app.jwt.sign({ sub: user.id });
    const res = await app.inject({
      method: "POST",
      url: "/api/recommendations/generate",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("inserted");
    expect(typeof body.inserted).toBe("number");
    expect(body.inserted).toBeGreaterThanOrEqual(0);
  });

  it("remplace les recos existantes sans feedback", async () => {
    const app = await buildApp();

    // Seed user
    const [user] = await db
      .insert(users)
      .values({
        email: "replace-reco@test.com",
        username: "replacereco",
        passwordHash: "x",
      })
      .returning({ id: users.id });

    // Seed games
    const [game1] = await db
      .insert(games)
      .values({ title: "Game 1", slug: "game-1" })
      .returning({ id: games.id });
    const [game2] = await db
      .insert(games)
      .values({ title: "Game 2", slug: "game-2" })
      .returning({ id: games.id });

    // Seed genre
    const [genre] = await db
      .insert(genres)
      .values({ name: "RPG", slug: "rpg" })
      .returning({ id: genres.id });

    await db.insert(gameGenres).values([
      { gameId: game1.id, genreId: genre.id },
      { gameId: game2.id, genreId: genre.id },
    ]);

    // Add games to library
    await db.insert(userGames).values([
      { userId: user.id, gameId: game1.id, status: "backlog" },
      { userId: user.id, gameId: game2.id, status: "backlog" },
    ]);

    // Seed initial reco without feedback
    const [oldReco] = await db
      .insert(recommendations)
      .values({
        userId: user.id,
        gameId: game1.id,
        bucket: "library_unplayed",
        score: "0.5",
        reason: { text: "Old reco", factors: {} },
        feedback: null,
      })
      .returning({ id: recommendations.id });

    const token = app.jwt.sign({ sub: user.id });

    // Call generate
    const res = await app.inject({
      method: "POST",
      url: "/api/recommendations/generate",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);

    // Verify old reco was replaced (removed if no feedback)
    const stillExists = await db.query.recommendations.findFirst({
      where: (t) => eq(t.id, oldReco.id),
    });
    // Old reco should be deleted after regeneration (no feedback means it's replaced)
    expect(stillExists).toBeUndefined();
    expect(res.json().inserted).toBeGreaterThanOrEqual(0);
  });

  it("preserve recos avec feedback", async () => {
    const app = await buildApp();

    // Seed user
    const [user] = await db
      .insert(users)
      .values({
        email: "preserve-reco@test.com",
        username: "preservereco",
        passwordHash: "x",
      })
      .returning({ id: users.id });

    // Seed games
    const [game1] = await db
      .insert(games)
      .values({ title: "Game 1", slug: "game-1" })
      .returning({ id: games.id });
    const [game2] = await db
      .insert(games)
      .values({ title: "Game 2", slug: "game-2" })
      .returning({ id: games.id });

    // Seed genre
    const [genre] = await db
      .insert(genres)
      .values({ name: "Adventure", slug: "adventure" })
      .returning({ id: genres.id });

    await db.insert(gameGenres).values([
      { gameId: game1.id, genreId: genre.id },
      { gameId: game2.id, genreId: genre.id },
    ]);

    // Add games to library
    await db.insert(userGames).values([
      { userId: user.id, gameId: game1.id, status: "backlog" },
      { userId: user.id, gameId: game2.id, status: "backlog" },
    ]);

    // Seed reco with feedback (should be preserved)
    const [recoWithFeedback] = await db
      .insert(recommendations)
      .values({
        userId: user.id,
        gameId: game1.id,
        bucket: "library_unplayed",
        score: "0.5",
        reason: { text: "User liked this", factors: {} },
        feedback: "liked",
      })
      .returning({ id: recommendations.id });

    const token = app.jwt.sign({ sub: user.id });

    // Call generate
    await app.inject({
      method: "POST",
      url: "/api/recommendations/generate",
      headers: { authorization: `Bearer ${token}` },
    });

    // Verify reco with feedback still exists
    const preserved = await db.query.recommendations.findFirst({
      where: (t) => eq(t.id, recoWithFeedback.id),
    });
    expect(preserved).toBeDefined();
    expect(preserved?.feedback).toBe("liked");
  });
});

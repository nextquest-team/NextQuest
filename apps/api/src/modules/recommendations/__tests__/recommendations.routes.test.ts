import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import { db, users, games, recommendations, gameGenres, genres } from "@nextquest/db";
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
  const [r1] = await db
    .insert(recommendations)
    .values({
      userId: u.id,
      gameId: g1.id,
      bucket: "library_unplayed",
      score: "0.95",
      reason: { text: "Test reason 1", factors: { matchG: 0.8 } },
      feedback: null,
    })
    .returning({ id: recommendations.id });

  const [r2] = await db
    .insert(recommendations)
    .values({
      userId: u.id,
      gameId: g2.id,
      bucket: "discovery",
      score: "0.85",
      reason: { text: "Test reason 2", factors: { matchG: 0.7 } },
      feedback: null,
    })
    .returning({ id: recommendations.id });

  const [r3] = await db
    .insert(recommendations)
    .values({
      userId: u.id,
      gameId: g3.id,
      bucket: "upcoming",
      score: "0.75",
      reason: { text: "Test reason 3", factors: { matchG: 0.6 } },
      feedback: null,
    })
    .returning({ id: recommendations.id });

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

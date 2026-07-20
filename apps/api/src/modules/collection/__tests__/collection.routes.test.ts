import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import { db, users, games, userGames, userGameExclusions } from "@nextquest/db";
import { eq } from "drizzle-orm";
import { validatorCompiler } from "fastify-type-provider-zod";
import { registerJwt } from "../../../plugins/jwt.js";
import { registerErrorHandler } from "../../../lib/error-handler.js";
import { registerSwagger } from "../../../plugins/swagger.js";
import { collectionRoutes } from "../collection.routes.js";
import { deleteCollectionItem } from "../collection.service.js";
import type { GameStatus } from "../collection.schemas.js";

async function buildApp() {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  registerErrorHandler(app);
  await registerSwagger(app);
  await registerJwt(app);
  await app.register(collectionRoutes, { prefix: "/api" });
  await app.ready();
  return app;
}

async function cleanup() {
  await db.delete(userGames);
  await db.delete(userGameExclusions);
  await db.delete(games);
  await db.delete(users);
}

async function seedUserGame(status: GameStatus = "backlog") {
  const [u] = await db
    .insert(users)
    .values({
      email: "collection-route@test.com",
      username: "collroute",
      passwordHash: "x",
    })
    .returning({ id: users.id });
  const [g] = await db
    .insert(games)
    .values({ title: "Test Game", slug: "test-game-route" })
    .returning({ id: games.id });
  const [ug] = await db
    .insert(userGames)
    .values({ userId: u.id, gameId: g.id, status })
    .returning({ id: userGames.id });
  return { userId: u.id, userGameId: ug.id };
}

beforeEach(cleanup);

describe("PATCH /api/collection/:userGameId/status", () => {
  it("renvoie 401 sans JWT", async () => {
    const app = await buildApp();
    const { userGameId } = await seedUserGame();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/collection/${userGameId}/status`,
      payload: { status: "playing" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("renvoie 400 sur un statut hors MVP (wishlist)", async () => {
    const app = await buildApp();
    const { userId, userGameId } = await seedUserGame();
    const token = app.jwt.sign({ sub: userId });
    const res = await app.inject({
      method: "PATCH",
      url: `/api/collection/${userGameId}/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: "wishlist" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("renvoie 404 quand le user_game appartient a un autre user", async () => {
    const app = await buildApp();
    const { userGameId } = await seedUserGame(); // possede par l'user A
    const [other] = await db
      .insert(users)
      .values({ email: "other@test.com", username: "other", passwordHash: "x" })
      .returning({ id: users.id });
    const token = app.jwt.sign({ sub: other.id });
    const res = await app.inject({
      method: "PATCH",
      url: `/api/collection/${userGameId}/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: "playing" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("renvoie 200 et passe le jeu en playing avec started_at renseigne", async () => {
    const app = await buildApp();
    const { userId, userGameId } = await seedUserGame("backlog");
    const token = app.jwt.sign({ sub: userId });
    const res = await app.inject({
      method: "PATCH",
      url: `/api/collection/${userGameId}/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: "playing" },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("playing");
    expect(body.startedAt).not.toBeNull();
  });

  it("renvoie 400 sur un body vide", async () => {
    const app = await buildApp();
    const { userId, userGameId } = await seedUserGame();
    const token = app.jwt.sign({ sub: userId });
    const res = await app.inject({
      method: "PATCH",
      url: `/api/collection/${userGameId}/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("renvoie 400 sur un userGameId non-uuid", async () => {
    const app = await buildApp();
    const { userId } = await seedUserGame();
    const token = app.jwt.sign({ sub: userId });
    const res = await app.inject({
      method: "PATCH",
      url: `/api/collection/not-a-uuid/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: "playing" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("renvoie 200 (no-op) si le statut est inchange", async () => {
    const app = await buildApp();
    const { userId, userGameId } = await seedUserGame("playing");
    const token = app.jwt.sign({ sub: userId });
    const res = await app.inject({
      method: "PATCH",
      url: `/api/collection/${userGameId}/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: "playing" },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).status).toBe("playing");
  });

  it("documente le body de la route dans l'OpenAPI", async () => {
    const app = await buildApp();
    const spec = app.swagger() as {
      paths: Record<string, Record<string, { requestBody?: unknown }>>;
    };
    const op = spec.paths["/api/collection/{userGameId}/status"].patch;
    expect(op.requestBody).toBeDefined();
    expect(JSON.stringify(op.requestBody)).toContain("playing");
  });
});

describe("GET /api/collection", () => {
  it("401 sans JWT", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/collection" });
    expect(res.statusCode).toBe(401);
  });
  it("200 et renvoie items + total + limit + offset", async () => {
    const app = await buildApp();
    const { userId } = await seedUserGame("playing");
    const token = app.jwt.sign({ sub: userId });
    const res = await app.inject({
      method: "GET",
      url: "/api/collection",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.total).toBe(1);
    expect(body.items[0].game.title).toBeDefined();
    expect(body.limit).toBe(20);
  });
  it("400 si limit > 100", async () => {
    const app = await buildApp();
    const { userId } = await seedUserGame();
    const token = app.jwt.sign({ sub: userId });
    const res = await app.inject({
      method: "GET",
      url: "/api/collection?limit=999",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /api/collection/:userGameId", () => {
  it("404 si le jeu appartient a un autre user", async () => {
    const app = await buildApp();
    const { userGameId } = await seedUserGame();
    const [other] = await db
      .insert(users)
      .values({ email: "o2@test.com", username: "o2", passwordHash: "x" })
      .returning({ id: users.id });
    const token = app.jwt.sign({ sub: other.id });
    const res = await app.inject({
      method: "GET",
      url: `/api/collection/${userGameId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });
  it("200 et renvoie le detail du jeu possede", async () => {
    const app = await buildApp();
    const { userId, userGameId } = await seedUserGame();
    const token = app.jwt.sign({ sub: userId });
    const res = await app.inject({
      method: "GET",
      url: `/api/collection/${userGameId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).userGameId).toBe(userGameId);
  });
});

describe("PATCH /api/collection/:userGameId", () => {
  it("400 sur body vide", async () => {
    const app = await buildApp();
    const { userId, userGameId } = await seedUserGame();
    const token = app.jwt.sign({ sub: userId });
    const res = await app.inject({
      method: "PATCH",
      url: `/api/collection/${userGameId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
  it("200 met a jour la note", async () => {
    const app = await buildApp();
    const { userId, userGameId } = await seedUserGame();
    const token = app.jwt.sign({ sub: userId });
    const res = await app.inject({
      method: "PATCH",
      url: `/api/collection/${userGameId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { rating: 7 },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).rating).toBe(7);
  });
});

describe("DELETE /api/collection/:userGameId", () => {
  it("204 et supprime", async () => {
    const app = await buildApp();
    const { userId, userGameId } = await seedUserGame();
    const token = app.jwt.sign({ sub: userId });
    const res = await app.inject({
      method: "DELETE",
      url: `/api/collection/${userGameId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(204);
  });
  it("404 si non possede", async () => {
    const app = await buildApp();
    const { userGameId } = await seedUserGame();
    const [other] = await db
      .insert(users)
      .values({ email: "o3@test.com", username: "o3", passwordHash: "x" })
      .returning({ id: users.id });
    const token = app.jwt.sign({ sub: other.id });
    const res = await app.inject({
      method: "DELETE",
      url: `/api/collection/${userGameId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("POST /api/collection", () => {
  it("201 ajoute un jeu existant", async () => {
    const app = await buildApp();
    const { userId } = await seedUserGame();
    const [g] = await db
      .insert(games)
      .values({ title: "Add Me", slug: "add-me-1" })
      .returning({ id: games.id });
    const token = app.jwt.sign({ sub: userId });
    const res = await app.inject({
      method: "POST",
      url: "/api/collection",
      headers: { authorization: `Bearer ${token}` },
      payload: { gameId: g.id },
    });
    expect(res.statusCode).toBe(201);
  });
  it("404 si le jeu n'existe pas", async () => {
    const app = await buildApp();
    const { userId } = await seedUserGame();
    const token = app.jwt.sign({ sub: userId });
    const res = await app.inject({
      method: "POST",
      url: "/api/collection",
      headers: { authorization: `Bearer ${token}` },
      payload: { gameId: "00000000-0000-0000-0000-000000000000" },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("GET /api/collection/exclusions", () => {
  it("401 sans JWT", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/collection/exclusions",
    });
    expect(res.statusCode).toBe(401);
  });

  it("200 et renvoie les jeux exclus du user", async () => {
    const app = await buildApp();
    const { userId, userGameId } = await seedUserGame();
    await deleteCollectionItem(userId, userGameId);

    const token = app.jwt.sign({ sub: userId });
    const res = await app.inject({
      method: "GET",
      url: "/api/collection/exclusions",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].title).toBe("Test Game");
  });
});

describe("POST /api/collection/exclusions/:gameId/restore", () => {
  it("401 sans JWT", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/collection/exclusions/00000000-0000-0000-0000-000000000000/restore",
    });
    expect(res.statusCode).toBe(401);
  });

  it("400 sur un gameId non-uuid", async () => {
    const app = await buildApp();
    const { userId } = await seedUserGame();
    const token = app.jwt.sign({ sub: userId });
    const res = await app.inject({
      method: "POST",
      url: "/api/collection/exclusions/not-a-uuid/restore",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it("201 reintegre le jeu exclu dans la collection", async () => {
    const app = await buildApp();
    const { userId, userGameId } = await seedUserGame();
    const [g] = await db
      .select({ gameId: userGames.gameId })
      .from(userGames)
      .where(eq(userGames.id, userGameId));
    await deleteCollectionItem(userId, userGameId);

    const token = app.jwt.sign({ sub: userId });
    const res = await app.inject({
      method: "POST",
      url: `/api/collection/exclusions/${g.gameId}/restore`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("backlog");
    expect(body.game.id).toBe(g.gameId);
  });

  it("404 si le jeu n'existe pas dans le catalogue", async () => {
    const app = await buildApp();
    const { userId } = await seedUserGame();
    const token = app.jwt.sign({ sub: userId });
    const res = await app.inject({
      method: "POST",
      url: "/api/collection/exclusions/00000000-0000-0000-0000-000000000000/restore",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

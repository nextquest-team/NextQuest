import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import { db, users, games, userGames } from "@nextquest/db";
import { validatorCompiler } from "fastify-type-provider-zod";
import { registerJwt } from "../../../plugins/jwt.js";
import { registerErrorHandler } from "../../../lib/error-handler.js";
import { registerSwagger } from "../../../plugins/swagger.js";
import { collectionRoutes } from "../collection.routes.js";
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

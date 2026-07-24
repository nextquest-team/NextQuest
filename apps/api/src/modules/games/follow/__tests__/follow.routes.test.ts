import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import { db, games, users } from "@nextquest/db";
import { eq } from "drizzle-orm";
import { validatorCompiler, serializerCompiler } from "fastify-type-provider-zod";
import { registerJwt } from "../../../../plugins/jwt.js";
import { registerRateLimit } from "../../../../plugins/rate-limit.js";
import { registerErrorHandler } from "../../../../lib/error-handler.js";
import { registerSwagger } from "../../../../plugins/swagger.js";
import { followRoutes } from "../follow.routes.js";

const TEST_EMAIL = "follow-route@test.com";
const TEST_IGDB_ID = 123456789;

async function buildApp() {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);
  await registerSwagger(app);
  await registerJwt(app);
  await registerRateLimit(app);
  await app.register(followRoutes, { prefix: "/api" });
  await app.ready();
  return app;
}

async function cleanup() {
  await db.delete(games).where(eq(games.igdbId, TEST_IGDB_ID)); // cascade purge follows
  await db.delete(users).where(eq(users.email, TEST_EMAIL));
}

async function seedUser() {
  const [u] = await db
    .insert(users)
    .values({ email: TEST_EMAIL, username: "followroute", passwordHash: "x" })
    .returning({ id: users.id });
  return u.id;
}

// Insere le jeu en BDD avant le follow : l'hydratation (deps par defaut,
// hydrateGamesByIgdbIds) devient alors no-op car le jeu existe deja, ce qui
// evite de taper IGDB dans ce test de routes.
async function seedGameInCatalog() {
  await db.insert(games).values({
    igdbId: TEST_IGDB_ID,
    title: "Follow Route Test Game",
    slug: `follow-route-test-game-${TEST_IGDB_ID}`,
    releaseDate: "2027-12-31",
    releaseDatePrecision: "year",
    releaseStatus: "upcoming",
    igdbHypes: 7,
  });
}

beforeEach(cleanup);

describe("follow routes", () => {
  it("401 sans JWT sur les trois routes", async () => {
    const app = await buildApp();
    for (const [method, url] of [
      ["POST", "/api/games/123/follow"],
      ["DELETE", "/api/games/123/follow"],
      ["GET", "/api/games/followed"],
    ] as const) {
      const res = await app.inject({ method, url });
      expect(res.statusCode).toBe(401);
    }
  });

  it("POST cree le suivi (201), GET le liste, DELETE le retire (204)", async () => {
    const app = await buildApp();
    const userId = await seedUser();
    await seedGameInCatalog(); // insere games avec igdbId TEST_IGDB_ID -> hydratation no-op
    const token = app.jwt.sign({ sub: userId, role: "user" }, { expiresIn: "5m" });
    const auth = { authorization: `Bearer ${token}` };

    const post = await app.inject({ method: "POST", url: `/api/games/${TEST_IGDB_ID}/follow`, headers: auth });
    expect(post.statusCode).toBe(201);
    expect(post.json()).toMatchObject({ igdbId: TEST_IGDB_ID });

    const list = await app.inject({ method: "GET", url: "/api/games/followed", headers: auth });
    expect(list.statusCode).toBe(200);
    expect(list.json().items).toHaveLength(1);

    const del = await app.inject({ method: "DELETE", url: `/api/games/${TEST_IGDB_ID}/follow`, headers: auth });
    expect(del.statusCode).toBe(204);

    const after = await app.inject({ method: "GET", url: "/api/games/followed", headers: auth });
    expect(after.json().items).toHaveLength(0);
  });

  it("400 si igdbId non numerique", async () => {
    const app = await buildApp();
    const userId = await seedUser();
    const token = app.jwt.sign({ sub: userId, role: "user" }, { expiresIn: "5m" });
    const res = await app.inject({
      method: "POST",
      url: "/api/games/abc/follow",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
  });
});

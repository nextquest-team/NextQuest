import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import { ZodError } from "zod";
import { eq } from "drizzle-orm";
import { db, users, sessions, authProviders } from "@nextquest/db";
import { registerJwt } from "../../../plugins/jwt.js";
import { registerCookie } from "../../../plugins/cookie.js";
import { registerRateLimit } from "../../../plugins/rate-limit.js";
import { usersRoutes } from "../users.routes.js";

async function buildApp() {
  const app = Fastify();

  app.setErrorHandler((error: Error & { statusCode?: number }, _req, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "Validation Error",
        details: error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      });
    }
    app.log.error(error);
    return reply.code(error.statusCode ?? 500).send({
      error: error.message || "Internal Server Error",
    });
  });

  await registerJwt(app);
  await registerCookie(app);
  await registerRateLimit(app);
  await app.register(usersRoutes, { prefix: "/api" });
  await app.ready();
  return app;
}

async function cleanup() {
  await db.delete(sessions);
  await db.delete(authProviders);
  await db.delete(users);
}

async function createTestUser() {
  const [user] = await db
    .insert(users)
    .values({
      email: `u-${Date.now()}-${Math.random()}@test.com`,
      username: `user${Date.now()}${Math.floor(Math.random() * 1000)}`,
      passwordHash: "argon2id$dummy",
      displayName: "Initial",
    })
    .returning();
  return user;
}

function getToken(app: Awaited<ReturnType<typeof buildApp>>, userId: string) {
  return app.jwt.sign({ sub: userId, role: "user" }, { expiresIn: "15m" });
}

describe("GET /api/users/me", () => {
  beforeEach(cleanup);

  it("renvoie 401 sans token", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/users/me" });
    expect(res.statusCode).toBe(401);
  });

  it("renvoie le DTO du user authentifie", async () => {
    const app = await buildApp();
    const user = await createTestUser();
    const token = getToken(app, user.id);

    const res = await app.inject({
      method: "GET",
      url: "/api/users/me",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(user.id);
    expect(body.displayName).toBe("Initial");
    expect(body.onboardingCompleted).toBe(false);
  });

  it("ne fuite JAMAIS les champs sensibles", async () => {
    const app = await buildApp();
    const user = await createTestUser();
    const token = getToken(app, user.id);

    const res = await app.inject({
      method: "GET",
      url: "/api/users/me",
      headers: { authorization: `Bearer ${token}` },
    });

    const body = res.json();
    expect(body.passwordHash).toBeUndefined();
    expect(body.failedLoginAttempts).toBeUndefined();
    expect(body.lockedUntil).toBeUndefined();
    expect(body.deletedAt).toBeUndefined();
    expect(body.role).toBeUndefined();
  });

  it("renvoie 404 si user soft-deleted", async () => {
    const app = await buildApp();
    const user = await createTestUser();
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, user.id));
    const token = getToken(app, user.id);

    const res = await app.inject({
      method: "GET",
      url: "/api/users/me",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("PATCH /api/users/me", () => {
  beforeEach(cleanup);

  it("renvoie 401 sans token", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: "/api/users/me",
      payload: { displayName: "X" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("met a jour le profil et renvoie le DTO", async () => {
    const app = await buildApp();
    const user = await createTestUser();
    const token = getToken(app, user.id);

    const res = await app.inject({
      method: "PATCH",
      url: "/api/users/me",
      headers: { authorization: `Bearer ${token}` },
      payload: { displayName: "Modifie", bio: "Nouvelle bio" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.displayName).toBe("Modifie");
    expect(body.bio).toBe("Nouvelle bio");
  });

  it("renvoie 400 sur body vide", async () => {
    const app = await buildApp();
    const user = await createTestUser();
    const token = getToken(app, user.id);

    const res = await app.inject({
      method: "PATCH",
      url: "/api/users/me",
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });

  it("renvoie 400 sur avatarUrl invalide", async () => {
    const app = await buildApp();
    const user = await createTestUser();
    const token = getToken(app, user.id);

    const res = await app.inject({
      method: "PATCH",
      url: "/api/users/me",
      headers: { authorization: `Bearer ${token}` },
      payload: { avatarUrl: "pas une url" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("renvoie 400 sur visibility inconnue", async () => {
    const app = await buildApp();
    const user = await createTestUser();
    const token = getToken(app, user.id);

    const res = await app.inject({
      method: "PATCH",
      url: "/api/users/me",
      headers: { authorization: `Bearer ${token}` },
      payload: { visibility: "everyone" },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe("POST /api/users/me/onboarding/complete", () => {
  beforeEach(cleanup);

  it("renvoie 401 sans token", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/users/me/onboarding/complete",
    });
    expect(res.statusCode).toBe(401);
  });

  it("passe onboardingCompleted a true", async () => {
    const app = await buildApp();
    const user = await createTestUser();
    const token = getToken(app, user.id);

    const res = await app.inject({
      method: "POST",
      url: "/api/users/me/onboarding/complete",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ onboardingCompleted: true });

    const [reloaded] = await db.select().from(users).where(eq(users.id, user.id));
    expect(reloaded.onboardingCompleted).toBe(true);
  });

  it("est idempotent (deux appels successifs renvoient 200)", async () => {
    const app = await buildApp();
    const user = await createTestUser();
    const token = getToken(app, user.id);

    await app.inject({
      method: "POST",
      url: "/api/users/me/onboarding/complete",
      headers: { authorization: `Bearer ${token}` },
    });

    const res2 = await app.inject({
      method: "POST",
      url: "/api/users/me/onboarding/complete",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res2.statusCode).toBe(200);
    expect(res2.json()).toEqual({ onboardingCompleted: true });
  });
});

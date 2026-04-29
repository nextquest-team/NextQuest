import { describe, it, expect, beforeEach } from "vitest";
import { db, users, authProviders, sessions } from "@nextquest/db";
import { ZodError } from "zod";
import Fastify from "fastify";
import { registerJwt } from "../../../plugins/jwt.js";
import { registerCookie } from "../../../plugins/cookie.js";
import { registerRateLimit } from "../../../plugins/rate-limit.js";
import { authRoutes } from "../auth.routes.js";

async function buildApp() {
  const app = Fastify();

  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "Validation Error",
        details: error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
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
  await app.register(authRoutes, { prefix: "/api" });
  await app.ready();
  return app;
}

async function cleanup() {
  await db.delete(sessions);
  await db.delete(authProviders);
  await db.delete(users);
}

describe("GET /api/auth/me", () => {
  beforeEach(cleanup);

  it("returns 401 without bearer token", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 with invalid bearer token", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: {
        authorization: "Bearer invalid.token.here",
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns the current user profile when authenticated", async () => {
    const app = await buildApp();

    // Cree un user via le register endpoint (recupere le token au passage)
    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "alice@test.com",
        username: "alice",
        password: "Test1234!",
        displayName: "Alice",
      },
    });
    const { accessToken } = JSON.parse(registerRes.body);

    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const user = JSON.parse(res.body);
    expect(user).toMatchObject({
      email: "alice@test.com",
      username: "alice",
      displayName: "Alice",
      locale: "fr",
      role: "user",
      emailVerified: false,
      visibility: "public",
    });
    // Champs sensibles ne doivent jamais etre presents
    expect(user.passwordHash).toBeUndefined();
    expect(user.failedLoginAttempts).toBeUndefined();
    expect(user.lockedUntil).toBeUndefined();
  });

  it("returns 404 when the user has been soft-deleted", async () => {
    const app = await buildApp();

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "bob@test.com",
        username: "bob",
        password: "Test1234!",
      },
    });
    const { user, accessToken } = JSON.parse(registerRes.body);

    // Soft delete : on simule la suppression RGPD
    await db.update(users).set({ deletedAt: new Date() }).where(
      (await import("drizzle-orm")).eq(users.id, user.id),
    );

    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(res.statusCode).toBe(404);
  });
});

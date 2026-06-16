import { describe, it, expect, beforeEach } from "vitest";
import { db, users, authProviders, sessions } from "@nextquest/db";
import Fastify from "fastify";
import { validatorCompiler } from "fastify-type-provider-zod";
import { registerJwt } from "../../../plugins/jwt.js";
import { registerCookie } from "../../../plugins/cookie.js";
import { registerRateLimit } from "../../../plugins/rate-limit.js";
import { registerErrorHandler } from "../../../lib/error-handler.js";
import { registerSwagger } from "../../../plugins/swagger.js";
import { authRoutes } from "../auth.routes.js";

async function buildApp() {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  registerErrorHandler(app);
  await registerSwagger(app);
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
      emailVerified: false,
      visibility: "public",
    });
    // role est volontairement absent du DTO public -- le client lit le JWT pour ca
    expect(user.role).toBeUndefined();
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

// UA Safari recent : 121 chars, depasse la limite varchar(100) de sessions.device_name
const LONG_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";

describe("POST /api/auth/register", () => {
  beforeEach(cleanup);

  it("accepte un User-Agent de plus de 100 caracteres sans planter", async () => {
    expect(LONG_UA.length).toBeGreaterThan(100);
    const app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      headers: { "user-agent": LONG_UA },
      payload: {
        email: "long-ua@test.com",
        username: "longua",
        password: "Test1234!",
      },
    });

    expect(res.statusCode).toBe(201);

    // La session doit etre persistee : device_name court (ou null), user_agent complet
    const [session] = await db.select().from(sessions);
    expect(session).toBeDefined();
    expect(session.userAgent).toBe(LONG_UA);
    if (session.deviceName !== null) {
      expect(session.deviceName.length).toBeLessThanOrEqual(100);
    }
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(cleanup);

  it("accepte un User-Agent de plus de 100 caracteres sans planter", async () => {
    const app = await buildApp();

    // On cree d'abord le compte avec un UA court (pas le sujet du test)
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      headers: { "user-agent": "node-test" },
      payload: {
        email: "login-ua@test.com",
        username: "loginua",
        password: "Test1234!",
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { "user-agent": LONG_UA },
      payload: {
        email: "login-ua@test.com",
        password: "Test1234!",
      },
    });

    expect(res.statusCode).toBe(200);
  });
});

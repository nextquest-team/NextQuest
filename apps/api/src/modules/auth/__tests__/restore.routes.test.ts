import { describe, it, expect, beforeEach } from "vitest";
import { db, users, authProviders, sessions } from "@nextquest/db";
import { eq } from "drizzle-orm";
import Fastify from "fastify";
import { validatorCompiler, serializerCompiler } from "fastify-type-provider-zod";
import { registerJwt } from "../../../plugins/jwt.js";
import { registerCookie } from "../../../plugins/cookie.js";
import { registerRateLimit } from "../../../plugins/rate-limit.js";
import { registerErrorHandler } from "../../../lib/error-handler.js";
import { registerSwagger } from "../../../plugins/swagger.js";
import { authRoutes } from "../auth.routes.js";
import { softDeleteAccount } from "../../users/account-deletion.service.js";
import { RESTORE_TOKEN_PURPOSE } from "../auth.schemas.js";

async function buildApp() {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
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

const PASSWORD = "Test1234!";

describe("POST /api/auth/restore", () => {
  beforeEach(cleanup);

  it("200 : restaure le compte et reconnecte (tokens + cookie)", async () => {
    const app = await buildApp();

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "restore@test.com",
        username: "restoreuser",
        password: PASSWORD,
      },
    });
    const { user } = JSON.parse(registerRes.body);
    await softDeleteAccount(user.id);

    const restoreToken = app.jwt.sign(
      { sub: user.id, purpose: RESTORE_TOKEN_PURPOSE },
      { expiresIn: "15m" },
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/restore",
      payload: { restoreToken },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    expect(body.user).toMatchObject({
      id: user.id,
      email: "restore@test.com",
      username: "restoreuser",
      locale: "fr",
      role: "user",
    });
    // La forme doit etre identique au login : pas de champs du DTO complet
    expect(body.user.passwordHash).toBeUndefined();
    expect(body.user.avatarUrl).toBeUndefined();
    expect(res.headers["set-cookie"]).toBeDefined();

    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row.deletedAt).toBeNull();
  });

  it("401 : access token classique refuse (purpose manquant)", async () => {
    const app = await buildApp();

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "classic@test.com",
        username: "classicuser",
        password: PASSWORD,
      },
    });
    const { user } = JSON.parse(registerRes.body);
    await softDeleteAccount(user.id);

    // Un access token normal (sub + role, pas de purpose) ne doit jamais suffire
    const accessToken = app.jwt.sign({ sub: user.id, role: "user" }, { expiresIn: "15m" });

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/restore",
      payload: { restoreToken: accessToken },
    });

    expect(res.statusCode).toBe(401);

    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row.deletedAt).not.toBeNull();
  });

  it("401 : token expire ou signature invalide", async () => {
    const app = await buildApp();

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "expired@test.com",
        username: "expireduser",
        password: PASSWORD,
      },
    });
    const { user } = JSON.parse(registerRes.body);
    await softDeleteAccount(user.id);

    const expiredToken = app.jwt.sign(
      { sub: user.id, purpose: RESTORE_TOKEN_PURPOSE },
      { expiresIn: "1ms" },
    );
    // Laisser le temps au token d'expirer (1ms est borderline sinon)
    await new Promise((resolve) => setTimeout(resolve, 50));

    const resExpired = await app.inject({
      method: "POST",
      url: "/api/auth/restore",
      payload: { restoreToken: expiredToken },
    });
    expect(resExpired.statusCode).toBe(401);

    const resBogus = await app.inject({
      method: "POST",
      url: "/api/auth/restore",
      payload: { restoreToken: "abc" },
    });
    expect(resBogus.statusCode).toBe(401);
  });

  it("410 : grace expiree", async () => {
    const app = await buildApp();

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "gone@test.com",
        username: "goneuser",
        password: PASSWORD,
      },
    });
    const { user } = JSON.parse(registerRes.body);
    await softDeleteAccount(user.id);

    // Grace par defaut = 30 jours : J-31 simule une grace deja expiree
    const expiredDeletedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    await db.update(users).set({ deletedAt: expiredDeletedAt }).where(eq(users.id, user.id));

    const restoreToken = app.jwt.sign(
      { sub: user.id, purpose: RESTORE_TOKEN_PURPOSE },
      { expiresIn: "15m" },
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/restore",
      payload: { restoreToken },
    });

    expect(res.statusCode).toBe(410);
  });

  it("410 : compte deja actif (token rejoue apres restauration)", async () => {
    const app = await buildApp();

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "replay@test.com",
        username: "replayuser",
        password: PASSWORD,
      },
    });
    const { user } = JSON.parse(registerRes.body);
    await softDeleteAccount(user.id);

    const restoreToken = app.jwt.sign(
      { sub: user.id, purpose: RESTORE_TOKEN_PURPOSE },
      { expiresIn: "15m" },
    );

    const first = await app.inject({
      method: "POST",
      url: "/api/auth/restore",
      payload: { restoreToken },
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: "POST",
      url: "/api/auth/restore",
      payload: { restoreToken },
    });
    expect(second.statusCode).toBe(410);
  });
});

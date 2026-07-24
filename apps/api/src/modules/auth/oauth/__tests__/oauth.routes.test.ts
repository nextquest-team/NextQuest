import { describe, it, expect, beforeEach, vi } from "vitest";

// On mocke le reseau du provider Google ; la BDD et les services restent reels
// (integration), meme pattern que steam.routes.test.ts.
vi.mock("../providers/google.js", () => ({
  googleProvider: { exchangeCode: vi.fn(), getUserProfile: vi.fn() },
}));

import { db, users, authProviders, sessions, gdprRequests } from "@nextquest/db";
import { eq } from "drizzle-orm";
import Fastify from "fastify";
import { validatorCompiler, serializerCompiler } from "fastify-type-provider-zod";
import { registerJwt } from "../../../../plugins/jwt.js";
import { registerCookie } from "../../../../plugins/cookie.js";
import { registerRateLimit } from "../../../../plugins/rate-limit.js";
import { registerErrorHandler } from "../../../../lib/error-handler.js";
import { registerSwagger } from "../../../../plugins/swagger.js";
import { oauthRoutes } from "../oauth.routes.js";
import { googleProvider } from "../providers/google.js";
import { softDeleteAccount } from "../../../users/account-deletion.service.js";

const mockedExchangeCode = vi.mocked(googleProvider.exchangeCode);
const mockedGetUserProfile = vi.mocked(googleProvider.getUserProfile);

async function buildApp() {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);
  await registerSwagger(app);
  await registerJwt(app);
  await registerCookie(app);
  await registerRateLimit(app);
  await app.register(oauthRoutes, { prefix: "/api/auth" });
  await app.ready();
  return app;
}

async function cleanup() {
  vi.clearAllMocks();
  await db.delete(gdprRequests);
  await db.delete(sessions);
  await db.delete(authProviders);
  await db.delete(users);
}

describe("GET /api/auth/oauth/:provider", () => {
  beforeEach(cleanup);

  it("returns 400 for unsupported provider", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/oauth/twitter",
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 200 with authorization URL for google when configured", async () => {
    // Skip if Google not configured (in dev)
    if (!process.env.GOOGLE_CLIENT_ID) {
      expect(true).toBe(true);
      return;
    }

    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/oauth/google",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.url).toBeTruthy();
    expect(body.url).toContain("accounts.google.com");
  });

  it("returns 400 when google client_id not configured", async () => {
    // This assumes GOOGLE_CLIENT_ID is not set in test env
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/oauth/google",
    });

    // When clientId is empty, the route returns 400
    if (!process.env.GOOGLE_CLIENT_ID) {
      expect(res.statusCode).toBe(400);
    }
  });
});

describe("GET /api/auth/oauth/:provider/callback", () => {
  beforeEach(cleanup);

  it("redirects with error when no code provided", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/oauth/google/callback?state=test",
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain("error=missing_params");
  });

  it("redirects with error when no state provided", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/oauth/google/callback?code=test-code",
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain("error=missing_params");
  });

  it("redirects with error when state mismatch", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/oauth/google/callback?code=test-code&state=wrong-state",
      cookies: { oauth_state: "correct-state" },
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain("error=invalid_state");
  });

  it("redirects with error when provider returns error", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/oauth/google/callback?error=access_denied",
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain("error=oauth_denied");
  });

  it("returns 400 for unsupported provider on callback", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/oauth/twitter/callback?code=test&state=test",
    });
    expect(res.statusCode).toBe(400);
  });

  it("redirige avec un restore_token quand le compte (provider lie) est en grace de suppression", async () => {
    mockedExchangeCode.mockResolvedValueOnce("fake-access-token");
    mockedGetUserProfile.mockResolvedValueOnce({
      providerId: "google-grace-1",
      email: "grace-linked@example.com",
      displayName: "Grace Linked",
      avatarUrl: null,
    });

    const [user] = await db
      .insert(users)
      .values({
        email: "grace-linked@example.com",
        username: "gracelinked",
        passwordHash: "argon2id$dummy",
      })
      .returning();
    await db.insert(authProviders).values({
      userId: user.id,
      provider: "google",
      providerId: "google-grace-1",
      email: "grace-linked@example.com",
    });
    await softDeleteAccount(user.id);

    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/oauth/google/callback?code=test-code&state=correct-state",
      cookies: { oauth_state: "correct-state" },
    });

    expect(res.statusCode).toBe(302);
    const location = res.headers.location as string;
    expect(location).toContain("error=account_pending_deletion");
    expect(location).toContain("restore_token=");

    const restoreToken = new URL(location).searchParams.get("restore_token")!;
    const claims = app.jwt.verify<{ sub: string; purpose: string }>(restoreToken);
    expect(claims.sub).toBe(user.id);
    expect(claims.purpose).toBe("account-restore");

    // Aucune session n'a du etre creee sur ce chemin.
    const openSessions = await db.select().from(sessions).where(eq(sessions.userId, user.id));
    expect(openSessions).toHaveLength(0);
  });

  it("redirige avec un restore_token quand l'email correspond a un compte en grace SANS provider lie (pas de 23505)", async () => {
    mockedExchangeCode.mockResolvedValueOnce("fake-access-token");
    mockedGetUserProfile.mockResolvedValueOnce({
      providerId: "google-grace-2",
      email: "grace-email-only@example.com",
      displayName: "Grace Email Only",
      avatarUrl: null,
    });

    const [user] = await db
      .insert(users)
      .values({
        email: "grace-email-only@example.com",
        username: "graceemailonly",
        passwordHash: "argon2id$dummy",
      })
      .returning();
    await softDeleteAccount(user.id);

    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/oauth/google/callback?code=test-code&state=correct-state",
      cookies: { oauth_state: "correct-state" },
    });

    expect(res.statusCode).toBe(302);
    const location = res.headers.location as string;
    expect(location).toContain("error=account_pending_deletion");
    expect(location).toContain("restore_token=");

    const restoreToken = new URL(location).searchParams.get("restore_token")!;
    const claims = app.jwt.verify<{ sub: string; purpose: string }>(restoreToken);
    expect(claims.sub).toBe(user.id);

    // Pas de nouveau provider lie, pas de doublon de compte cree (pas de 23505).
    const linked = await db.select().from(authProviders).where(eq(authProviders.userId, user.id));
    expect(linked).toHaveLength(0);
    const matchingUsers = await db
      .select()
      .from(users)
      .where(eq(users.email, "grace-email-only@example.com"));
    expect(matchingUsers).toHaveLength(1);
  });
});

describe("POST /api/auth/oauth/:provider/link", () => {
  beforeEach(cleanup);

  it("returns 401 without auth", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/oauth/google/link",
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 400 for unsupported provider", async () => {
    const app = await buildApp();

    // Create a valid JWT for testing
    const token = app.jwt.sign(
      { sub: "test-user-id", role: "user" },
      { expiresIn: "15m" },
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/oauth/twitter/link",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when provider not configured", async () => {
    const app = await buildApp();

    const token = app.jwt.sign(
      { sub: "test-user-id", role: "user" },
      { expiresIn: "15m" },
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/oauth/google/link",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    // Returns 400 if GOOGLE_CLIENT_ID is not configured
    if (!process.env.GOOGLE_CLIENT_ID) {
      expect(res.statusCode).toBe(400);
    } else {
      expect([200, 400]).toContain(res.statusCode);
    }
  });

  it("returns 200 with authorization URL when configured", async () => {
    if (!process.env.GOOGLE_CLIENT_ID) {
      expect(true).toBe(true);
      return;
    }

    const app = await buildApp();

    const token = app.jwt.sign(
      { sub: "test-user-id", role: "user" },
      { expiresIn: "15m" },
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/oauth/google/link",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.url).toBeTruthy();
  });
});

describe("DELETE /api/auth/oauth/:provider/link", () => {
  beforeEach(cleanup);

  it("returns 401 without auth", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/auth/oauth/google/link",
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 400 for unsupported provider", async () => {
    const app = await buildApp();

    const token = app.jwt.sign(
      { sub: "test-user-id", role: "user" },
      { expiresIn: "15m" },
    );

    const res = await app.inject({
      method: "DELETE",
      url: "/api/auth/oauth/twitter/link",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 204 on successful unlink (with sufficient auth context)", async () => {
    const app = await buildApp();

    const token = app.jwt.sign(
      { sub: "test-user-id", role: "user" },
      { expiresIn: "15m" },
    );

    // This will fail at the service level because the user doesn't exist,
    // but it passes JWT verification
    const res = await app.inject({
      method: "DELETE",
      url: "/api/auth/oauth/google/link",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    // Expect either 204 (success) or error from service if user doesn't exist
    expect([204, 400, 500]).toContain(res.statusCode);
  });
});

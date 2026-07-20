import { describe, it, expect, beforeEach, vi } from "vitest";

// On mocke le reseau Steam et IGDB ; la BDD et les services restent reels (integration).
vi.mock("../steam.openid.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../steam.openid.js")>();
  return { ...actual, verifySteamAssertion: vi.fn() };
});
vi.mock("../steam.client.js", () => ({
  getOwnedGames: vi.fn(),
  getPlayerSummary: vi.fn(),
}));
vi.mock("../../../games/igdb/igdb.service.js", () => ({
  enrichGames: vi.fn().mockResolvedValue({ scanned: 0, mapped: 0, enriched: 0, notFound: 0, failed: 0 }),
}));

import Fastify from "fastify";
import { ZodError } from "zod";
import { db, users, connectedServices, userGames, games } from "@nextquest/db";
import { eq } from "drizzle-orm";
import { registerJwt } from "../../../../plugins/jwt.js";
import { registerRateLimit } from "../../../../plugins/rate-limit.js";
import { steamRoutes } from "../steam.routes.js";
import { verifySteamAssertion } from "../steam.openid.js";
import { getOwnedGames, getPlayerSummary } from "../steam.client.js";
import { linkSteamAccount } from "../steam.service.js";
import * as igdbService from "../../../games/igdb/igdb.service.js";
import { markEnrichStart } from "../../../games/igdb/enrich-progress.js";

const mockedVerify = vi.mocked(verifySteamAssertion);
const mockedGetOwnedGames = vi.mocked(getOwnedGames);
const mockedGetPlayerSummary = vi.mocked(getPlayerSummary);
const mockedEnrichGames = vi.mocked(igdbService.enrichGames);

async function buildApp() {
  const app = Fastify();
  app.setErrorHandler(
    (error: Error & { statusCode?: number }, _request, reply) => {
      if (error instanceof ZodError) {
        return reply.code(400).send({ error: "Validation Error" });
      }
      return reply
        .code(error.statusCode ?? 500)
        .send({ error: error.message || "Internal Server Error" });
    },
  );
  await registerJwt(app);
  await registerRateLimit(app);
  await app.register(steamRoutes, { prefix: "/api" });
  await app.ready();
  return app;
}

async function cleanup() {
  await db.delete(userGames);
  await db.delete(games);
  await db.delete(connectedServices);
  await db.delete(users);
}

async function createUserAndToken(app: Awaited<ReturnType<typeof buildApp>>) {
  const [u] = await db
    .insert(users)
    .values({
      email: "steam-route@test.com",
      username: "steamroute",
      passwordHash: "x",
    })
    .returning({ id: users.id });
  const token = app.jwt.sign({ sub: u.id });
  return { userId: u.id, token };
}

beforeEach(async () => {
  vi.clearAllMocks();
  await cleanup();
});

describe("GET /api/platforms/steam/link", () => {
  it("renvoie 401 sans JWT", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/platforms/steam/link",
    });
    expect(res.statusCode).toBe(401);
  });

  it("renvoie l'URL OpenID Steam avec un state quand authentifie", async () => {
    const app = await buildApp();
    const { token } = await createUserAndToken(app);

    const res = await app.inject({
      method: "GET",
      url: "/api/platforms/steam/link",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const { url } = JSON.parse(res.body);
    expect(url).toContain("https://steamcommunity.com/openid/login");
    const parsed = new URL(url);
    expect(parsed.searchParams.get("openid.return_to")).toContain("state=");
  });
});

describe("GET /api/platforms/steam/callback", () => {
  it("renvoie 401 si le state est invalide", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/platforms/steam/callback?state=garbage&openid.claimed_id=https://steamcommunity.com/openid/id/76561198000000000",
    });
    expect(res.statusCode).toBe(401);
  });

  it("lie le compte et redirige quand l'assertion est valide", async () => {
    const app = await buildApp();
    const { userId } = await createUserAndToken(app);
    const state = app.jwt.sign(
      { sub: userId, scope: "steam_link" },
      { expiresIn: "10m" },
    );
    mockedVerify.mockResolvedValue("76561198000000000");
    mockedGetPlayerSummary.mockResolvedValue({
      personaName: "Gaben",
      avatarUrl: null,
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/platforms/steam/callback?state=${state}&openid.claimed_id=https://steamcommunity.com/openid/id/76561198000000000`,
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain("steam=linked");

    const conn = await db
      .select()
      .from(connectedServices)
      .where(eq(connectedServices.userId, userId));
    expect(conn).toHaveLength(1);
    expect(conn[0].externalUserId).toBe("76561198000000000");
    expect(conn[0].externalUsername).toBe("Gaben");
  });

  it("renvoie 401 si Steam invalide l'assertion", async () => {
    const app = await buildApp();
    const { userId } = await createUserAndToken(app);
    const state = app.jwt.sign(
      { sub: userId, scope: "steam_link" },
      { expiresIn: "10m" },
    );
    mockedVerify.mockResolvedValue(null);

    const res = await app.inject({
      method: "GET",
      url: `/api/platforms/steam/callback?state=${state}`,
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /api/platforms/steam (statut)", () => {
  it("reflete l'etat de connexion", async () => {
    const app = await buildApp();
    const { userId, token } = await createUserAndToken(app);

    let res = await app.inject({
      method: "GET",
      url: "/api/platforms/steam",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(JSON.parse(res.body).connected).toBe(false);

    await linkSteamAccount(userId, "76561198000000000", "Gaben");

    res = await app.inject({
      method: "GET",
      url: "/api/platforms/steam",
      headers: { authorization: `Bearer ${token}` },
    });
    const body = JSON.parse(res.body);
    expect(body.connected).toBe(true);
    expect(body.steamId).toBe("76561198000000000");
  });
});

describe("DELETE /api/platforms/steam", () => {
  it("delie le compte Steam", async () => {
    const app = await buildApp();
    const { userId, token } = await createUserAndToken(app);
    await linkSteamAccount(userId, "76561198000000000", "Gaben");

    const res = await app.inject({
      method: "DELETE",
      url: "/api/platforms/steam",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).unlinked).toBe(true);
  });
});

describe("POST /api/platforms/steam/import", () => {
  it("renvoie 409 si aucun compte Steam n'est lie", async () => {
    const app = await buildApp();
    const { token } = await createUserAndToken(app);

    const res = await app.inject({
      method: "POST",
      url: "/api/platforms/steam/import",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(409);
  });

  it("importe la bibliotheque quand un compte est lie", async () => {
    const app = await buildApp();
    const { userId, token } = await createUserAndToken(app);
    await linkSteamAccount(userId, "76561198000000000", "Gaben");
    mockedGetOwnedGames.mockResolvedValue([
      { appid: 570, name: "Dota 2", playtimeMinutes: 1200 },
    ]);

    const res = await app.inject({
      method: "POST",
      url: "/api/platforms/steam/import",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).imported).toBe(1);
  });

  it("avertit quand le profil est prive (aucun jeu recupere)", async () => {
    const app = await buildApp();
    const { userId, token } = await createUserAndToken(app);
    await linkSteamAccount(userId, "76561198000000000", "Gaben");
    mockedGetOwnedGames.mockResolvedValue([]);

    const res = await app.inject({
      method: "POST",
      url: "/api/platforms/steam/import",
      headers: { authorization: `Bearer ${token}` },
    });

    const body = JSON.parse(res.body);
    expect(body.imported).toBe(0);
    expect(body.warning).toBeTruthy();
  });

  it("renvoie 502 si l'API Steam echoue", async () => {
    const app = await buildApp();
    const { userId, token } = await createUserAndToken(app);
    await linkSteamAccount(userId, "76561198000000000", "Gaben");
    mockedGetOwnedGames.mockRejectedValue(new Error("HTTP 500"));

    const res = await app.inject({
      method: "POST",
      url: "/api/platforms/steam/import",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(502);
  });

  it("declenche l'enrichissement IGDB en fire-and-forget apres import", async () => {
    const app = await buildApp();
    const { userId, token } = await createUserAndToken(app);
    await linkSteamAccount(userId, "76561198000000000", "Gaben");
    mockedGetOwnedGames.mockResolvedValue([
      { appid: 570, name: "Dota 2", playtimeMinutes: 1200 },
    ]);

    const res = await app.inject({
      method: "POST",
      url: "/api/platforms/steam/import",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(mockedEnrichGames).toHaveBeenCalledWith({ userId });
  });
});

describe("GET /api/platforms/steam/import/status", () => {
  it("renvoie 401 sans JWT", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/platforms/steam/import/status",
    });
    expect(res.statusCode).toBe(401);
  });

  it("renvoie idle quand aucun enrichissement n'est en cours", async () => {
    const app = await buildApp();
    const { token } = await createUserAndToken(app);

    const res = await app.inject({
      method: "GET",
      url: "/api/platforms/steam/import/status",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      status: "idle",
      total: 0,
      done: 0,
      games: [],
    });
  });

  it("renvoie la progression en cours", async () => {
    const app = await buildApp();
    const { userId, token } = await createUserAndToken(app);
    await markEnrichStart(userId, 5);

    const res = await app.inject({
      method: "GET",
      url: "/api/platforms/steam/import/status",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("running");
    expect(body.total).toBe(5);
    expect(body.done).toBe(0);
    expect(body.games).toEqual([]);
  });
});

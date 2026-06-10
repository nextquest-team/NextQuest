import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";
import { registerJwt } from "../../../../plugins/jwt.js";
import { registerRateLimit } from "../../../../plugins/rate-limit.js";
import { igdbRoutes } from "../igdb.routes.js";
import * as service from "../igdb.service.js";

vi.spyOn(service, "enrichGames").mockResolvedValue({
  scanned: 1,
  mapped: 1,
  enriched: 1,
  notFound: 0,
  failed: 0,
});

async function buildApp() {
  const app = Fastify();
  await registerJwt(app);
  await registerRateLimit(app);
  await app.register(igdbRoutes, { prefix: "/api" });
  await app.ready();
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/users/me/library/enrich", () => {
  it("401 sans token", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "POST", url: "/api/users/me/library/enrich" });
    expect(res.statusCode).toBe(401);
  });

  it("appelle enrichGames scopé au user et renvoie le résumé", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({ sub: "user-123", role: "user" });
    const res = await app.inject({
      method: "POST",
      url: "/api/users/me/library/enrich",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ enriched: 1 });
    expect(service.enrichGames).toHaveBeenCalledWith({ userId: "user-123" });
  });
});

describe("POST /api/admin/games/enrich", () => {
  it("403 pour un user non admin", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({ sub: "u", role: "user" });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/games/enrich",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    expect(service.enrichGames).not.toHaveBeenCalled();
  });

  it("appelle enrichGames global pour un admin", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({ sub: "admin-1", role: "admin" });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/games/enrich",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(service.enrichGames).toHaveBeenCalledWith({});
  });
});

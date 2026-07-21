import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";
import { validatorCompiler, serializerCompiler } from "fastify-type-provider-zod";
import { registerJwt } from "../../../../plugins/jwt.js";
import { registerRateLimit } from "../../../../plugins/rate-limit.js";
import { registerErrorHandler } from "../../../../lib/error-handler.js";
import { registerSwagger } from "../../../../plugins/swagger.js";
import { igdbRoutes } from "../igdb.routes.js";
import * as service from "../igdb.service.js";
import * as discovery from "../igdb.discovery.service.js";

vi.spyOn(service, "enrichGames").mockResolvedValue({
  scanned: 1,
  mapped: 1,
  enriched: 1,
  notFound: 0,
  failed: 0,
});

const upcomingSample = [
  {
    igdbId: 1,
    title: "Coming Soon",
    releaseDate: "2027-01-01",
    coverUrl: "https://img/cover.jpg",
    hypes: 100,
    genres: [{ igdbId: 12, name: "RPG", slug: "rpg" }],
    platforms: [{ igdbId: 6, name: "PC", abbreviation: "PC" }],
  },
];
// Forme complete d'un GameDetailDTO (gameDetailDTOSchema) : nullables a null,
// tableaux vides. La reponse etant desormais serialisee/validee par le schema
// Zod, le mock du service doit refleter la vraie forme, pas un stub partiel.
const detailSample = {
  igdbId: 1020,
  title: "GTA V",
  summary: null,
  storyline: null,
  releaseDate: null,
  releaseStatus: "released",
  coverUrl: null,
  artworkUrl: null,
  screenshots: [],
  videos: [],
  rating: null,
  ratingCount: null,
  hypes: null,
  developer: null,
  publisher: null,
  genres: [],
  themes: [],
  gameModes: [],
  playerPerspectives: [],
  platforms: [],
  websites: [],
  similarGames: [],
};

const getUpcomingSpy = vi.spyOn(discovery, "getUpcomingGames");
const getDetailSpy = vi.spyOn(discovery, "getGameDetail");

async function buildApp() {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);
  await registerSwagger(app);
  await registerJwt(app);
  await registerRateLimit(app);
  await app.register(igdbRoutes, { prefix: "/api" });
  await app.ready();
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  getUpcomingSpy.mockResolvedValue(upcomingSample as never);
  getDetailSpy.mockResolvedValue(detailSample as never);
});

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

describe("GET /api/games/upcoming", () => {
  it("401 sans token", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/games/upcoming" });
    expect(res.statusCode).toBe(401);
    expect(getUpcomingSpy).not.toHaveBeenCalled();
  });

  it("200 : renvoie items + pagination, defauts limit/offset/sort", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({ sub: "u", role: "user" });
    const res = await app.inject({
      method: "GET",
      url: "/api/games/upcoming",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ items: upcomingSample, limit: 20, offset: 0 });
    expect(getUpcomingSpy).toHaveBeenCalledWith({ limit: 20, offset: 0, sort: "hype" });
  });

  it("passe sort/limit/offset au service", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({ sub: "u", role: "user" });
    const res = await app.inject({
      method: "GET",
      url: "/api/games/upcoming?sort=date&limit=5&offset=10",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(getUpcomingSpy).toHaveBeenCalledWith({ limit: 5, offset: 10, sort: "date" });
  });

  it("400 si sort invalide", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({ sub: "u", role: "user" });
    const res = await app.inject({
      method: "GET",
      url: "/api/games/upcoming?sort=banana",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
    expect(getUpcomingSpy).not.toHaveBeenCalled();
  });

  it("400 si limit hors bornes", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({ sub: "u", role: "user" });
    const res = await app.inject({
      method: "GET",
      url: "/api/games/upcoming?limit=100",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it("502 si IGDB est indisponible", async () => {
    getUpcomingSpy.mockRejectedValueOnce(new Error("IGDB games a repondu HTTP 503"));
    const app = await buildApp();
    const token = app.jwt.sign({ sub: "u", role: "user" });
    const res = await app.inject({
      method: "GET",
      url: "/api/games/upcoming",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(502);
  });
});

describe("GET /api/games/igdb/:igdbId", () => {
  it("401 sans token", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/games/igdb/1020" });
    expect(res.statusCode).toBe(401);
    expect(getDetailSpy).not.toHaveBeenCalled();
  });

  it("200 : renvoie le detail et appelle le service avec l'igdbId", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({ sub: "u", role: "user" });
    const res = await app.inject({
      method: "GET",
      url: "/api/games/igdb/1020",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(detailSample);
    expect(getDetailSpy).toHaveBeenCalledWith(1020);
  });

  it("404 si le jeu est introuvable sur IGDB", async () => {
    getDetailSpy.mockResolvedValueOnce(null);
    const app = await buildApp();
    const token = app.jwt.sign({ sub: "u", role: "user" });
    const res = await app.inject({
      method: "GET",
      url: "/api/games/igdb/999999",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("400 si igdbId n'est pas un entier positif", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({ sub: "u", role: "user" });
    const res = await app.inject({
      method: "GET",
      url: "/api/games/igdb/abc",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
    expect(getDetailSpy).not.toHaveBeenCalled();
  });

  it("502 si IGDB est indisponible", async () => {
    getDetailSpy.mockRejectedValueOnce(new Error("IGDB games a repondu HTTP 500"));
    const app = await buildApp();
    const token = app.jwt.sign({ sub: "u", role: "user" });
    const res = await app.inject({
      method: "GET",
      url: "/api/games/igdb/1020",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(502);
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";
import { validatorCompiler } from "fastify-type-provider-zod";
import { searchGamesByName } from "../igdb.client.js";
import { searchIgdbGames, type DiscoveryDeps } from "../igdb.discovery.service.js";
import type { IgdbSearchGame } from "../igdb.client.js";
import { registerJwt } from "../../../../plugins/jwt.js";
import { registerRateLimit } from "../../../../plugins/rate-limit.js";
import { registerErrorHandler } from "../../../../lib/error-handler.js";
import { registerSwagger } from "../../../../plugins/swagger.js";
import { igdbRoutes } from "../igdb.routes.js";
import * as service from "../igdb.service.js";
import * as discovery from "../igdb.discovery.service.js";

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const err = (status: number) => ({ ok: false, status, json: async () => ({}) });

describe("searchGamesByName", () => {
  it("construit la requete Apicalypse (search+fields+limit) et mappe les champs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      ok([
        {
          id: 101,
          name: "Halo",
          cover: { image_id: "cov1" },
          first_release_date: 1000000000,
          platforms: [6, 48],
        },
      ]),
    );

    const results = await searchGamesByName("Halo", 12, "TOKEN", "CID", fetchMock);

    expect(results).toEqual([
      {
        igdbId: 101,
        name: "Halo",
        coverImageId: "cov1",
        firstReleaseDate: 1000000000,
        platformIds: [6, 48],
      },
    ]);

    const init = fetchMock.mock.calls[0][1];
    expect(init.headers["Client-ID"]).toBe("CID");
    expect(init.headers["Authorization"]).toBe("Bearer TOKEN");
    expect(init.body).toContain('search "Halo";');
    expect(init.body).toContain("fields name,cover.image_id,first_release_date,platforms;");
    expect(init.body).toContain("limit 12;");
  });

  it("echappe les guillemets et backslash dans le nom recherche", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([]));
    await searchGamesByName('The "Master" Chief\\', 12, "TOKEN", "CID", fetchMock);
    const init = fetchMock.mock.calls[0][1];
    expect(init.body).toContain('search "The \\"Master\\" Chief\\\\";');
  });

  it("tolere les champs absents (cover, date et plateformes manquants)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([{ id: 5, name: "Bare" }]));
    const [g] = await searchGamesByName("Bare", 12, "TOKEN", "CID", fetchMock);
    expect(g).toEqual({
      igdbId: 5,
      name: "Bare",
      coverImageId: null,
      firstReleaseDate: null,
      platformIds: [],
    });
  });

  it("leve si IGDB repond non-200", async () => {
    const fetchMock = vi.fn().mockResolvedValue(err(500));
    await expect(searchGamesByName("Halo", 12, "T", "C", fetchMock)).rejects.toThrow(/500/);
  });
});

function fakeCache() {
  const store = new Map<string, string>();
  return {
    store,
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    set: vi.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
  };
}

const FIXED_NOW = new Date("2026-06-22T00:00:00Z");

const searchSample: IgdbSearchGame[] = [
  {
    igdbId: 101,
    name: "Halo",
    coverImageId: "cov1",
    firstReleaseDate: 1000000000,
    platformIds: [6, 48],
  },
  { igdbId: 102, name: "Halo 2", coverImageId: null, firstReleaseDate: null, platformIds: [6] },
];

// Plateformes locales telles que renvoyees par la requete DB dans le service
// (id, name, igdbId) -- utilisees pour mocker findPlatformsByIgdbIds.
const localPlatforms = [
  { id: "plat-pc", name: "PC", igdbId: 6 },
  { id: "plat-ps4", name: "PlayStation 4", igdbId: 48 },
];

describe("searchIgdbGames", () => {
  it("cache miss: appelle IGDB (token), mappe coverUrl/releaseYear/plateformes, ecrit le cache 3600s", async () => {
    const cache = fakeCache();
    const searchGamesByNameMock = vi.fn(async () => searchSample);
    const findPlatformsByIgdbIdsMock = vi.fn(async () => localPlatforms);
    const deps = {
      getToken: vi.fn(async () => "TOKEN"),
      fetchUpcoming: vi.fn(),
      fetchGameDetail: vi.fn(),
      fetchGamesByIds: vi.fn(),
      fetchGamesByDeveloper: vi.fn(),
      searchGamesByName: searchGamesByNameMock,
      findOwnedIgdbIds: vi.fn(async () => new Set<number>()),
      findPlatformsByIgdbIds: findPlatformsByIgdbIdsMock,
      cache,
      now: () => FIXED_NOW,
    } as unknown as DiscoveryDeps;

    const res = await searchIgdbGames("halo", "user-1", 12, "CID", deps);

    expect(res).toEqual([
      {
        igdbId: 101,
        name: "Halo",
        coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/cov1.jpg",
        releaseYear: 2001,
        alreadyInCollection: false,
        platforms: [
          { id: "plat-pc", name: "PC" },
          { id: "plat-ps4", name: "PlayStation 4" },
        ],
      },
      {
        igdbId: 102,
        name: "Halo 2",
        coverUrl: null,
        releaseYear: null,
        alreadyInCollection: false,
        platforms: [{ id: "plat-pc", name: "PC" }],
      },
    ]);
    expect(searchGamesByNameMock).toHaveBeenCalledWith("halo", 12, "TOKEN", "CID");
    // Union dedupliquee des platformIds de tous les resultats : une seule requete DB.
    expect(findPlatformsByIgdbIdsMock).toHaveBeenCalledWith([6, 48]);
    expect(cache.set).toHaveBeenCalledWith("igdb:search:halo:12", expect.any(String), "EX", 3600);
    // Le cache ne stocke pas alreadyInCollection (specifique a l'utilisateur) ni
    // les plateformes mappees (recalculees a chaque lecture, nos plateformes
    // pouvant evoluer independamment du TTL de la recherche).
    const cached = JSON.parse(cache.store.get("igdb:search:halo:12") as string);
    expect(cached[0].alreadyInCollection).toBeUndefined();
    expect(cached[0].platforms).toBeUndefined();
    expect(cached[0].platformIds).toEqual([6, 48]);
  });

  it("cache hit: renvoie le cache sans appeler IGDB, mais remappe les plateformes depuis la BDD", async () => {
    const cache = fakeCache();
    cache.store.set(
      "igdb:search:zelda:12",
      JSON.stringify([
        { igdbId: 9, name: "Cached", coverUrl: null, releaseYear: null, platformIds: [6] },
      ]),
    );
    const searchGamesByNameMock = vi.fn();
    const findPlatformsByIgdbIdsMock = vi.fn(async () => [localPlatforms[0]]);
    const deps = {
      getToken: vi.fn(),
      fetchUpcoming: vi.fn(),
      fetchGameDetail: vi.fn(),
      fetchGamesByIds: vi.fn(),
      fetchGamesByDeveloper: vi.fn(),
      searchGamesByName: searchGamesByNameMock,
      findOwnedIgdbIds: vi.fn(async () => new Set<number>()),
      findPlatformsByIgdbIds: findPlatformsByIgdbIdsMock,
      cache,
      now: () => FIXED_NOW,
    } as unknown as DiscoveryDeps;

    const res = await searchIgdbGames("zelda", "user-1", 12, "CID", deps);

    expect(res).toEqual([
      {
        igdbId: 9,
        name: "Cached",
        coverUrl: null,
        releaseYear: null,
        alreadyInCollection: false,
        platforms: [{ id: "plat-pc", name: "PC" }],
      },
    ]);
    expect(searchGamesByNameMock).not.toHaveBeenCalled();
    expect(findPlatformsByIgdbIdsMock).toHaveBeenCalledWith([6]);
  });

  it("annote alreadyInCollection=true pour un candidat deja possede par le user", async () => {
    const cache = fakeCache();
    const deps = {
      getToken: vi.fn(async () => "TOKEN"),
      fetchUpcoming: vi.fn(),
      fetchGameDetail: vi.fn(),
      fetchGamesByIds: vi.fn(),
      fetchGamesByDeveloper: vi.fn(),
      searchGamesByName: vi.fn(async () => searchSample),
      findOwnedIgdbIds: vi.fn(async () => new Set<number>([101])),
      findPlatformsByIgdbIds: vi.fn(async () => localPlatforms),
      cache,
      now: () => FIXED_NOW,
    } as unknown as DiscoveryDeps;

    const res = await searchIgdbGames("halo", "user-1", 12, "CID", deps);

    expect(res.find((r) => r.igdbId === 101)?.alreadyInCollection).toBe(true);
    expect(res.find((r) => r.igdbId === 102)?.alreadyInCollection).toBe(false);
    expect(deps.findOwnedIgdbIds).toHaveBeenCalledWith("user-1", [101, 102]);
  });

  it("sans plateforme mappee en local (igdbId inconnu), renvoie un tableau platforms vide", async () => {
    const cache = fakeCache();
    const deps = {
      getToken: vi.fn(async () => "TOKEN"),
      fetchUpcoming: vi.fn(),
      fetchGameDetail: vi.fn(),
      fetchGamesByIds: vi.fn(),
      fetchGamesByDeveloper: vi.fn(),
      searchGamesByName: vi.fn(async () => searchSample),
      findOwnedIgdbIds: vi.fn(async () => new Set<number>()),
      findPlatformsByIgdbIds: vi.fn(async () => []),
      cache,
      now: () => FIXED_NOW,
    } as unknown as DiscoveryDeps;

    const res = await searchIgdbGames("halo", "user-1", 12, "CID", deps);

    expect(res.find((r) => r.igdbId === 101)?.platforms).toEqual([]);
  });

  it("propage l'erreur si IGDB echoue et n'ecrit pas le cache", async () => {
    const cache = fakeCache();
    const deps = {
      getToken: vi.fn(async () => "T"),
      fetchUpcoming: vi.fn(),
      fetchGameDetail: vi.fn(),
      fetchGamesByIds: vi.fn(),
      fetchGamesByDeveloper: vi.fn(),
      searchGamesByName: vi.fn(async () => {
        throw new Error("IGDB games a repondu HTTP 503");
      }),
      findOwnedIgdbIds: vi.fn(async () => new Set<number>()),
      findPlatformsByIgdbIds: vi.fn(async () => []),
      cache,
      now: () => FIXED_NOW,
    } as unknown as DiscoveryDeps;

    await expect(searchIgdbGames("halo", "user-1", 12, "CID", deps)).rejects.toThrow(/503/);
    expect(cache.set).not.toHaveBeenCalled();
  });
});

vi.spyOn(service, "enrichGames").mockResolvedValue({
  scanned: 0,
  mapped: 0,
  enriched: 0,
  notFound: 0,
  failed: 0,
});

const searchResultSample = [
  {
    igdbId: 101,
    name: "Halo",
    coverUrl: "https://img/cover.jpg",
    releaseYear: 2001,
    alreadyInCollection: false,
    platforms: [{ id: "plat-pc", name: "PC" }],
  },
];

const searchSpy = vi.spyOn(discovery, "searchIgdbGames");

async function buildApp() {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  registerErrorHandler(app);
  await registerSwagger(app);
  await registerJwt(app);
  await registerRateLimit(app);
  await app.register(igdbRoutes, { prefix: "/api" });
  await app.ready();
  return app;
}

describe("GET /api/games/igdb/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchSpy.mockResolvedValue(searchResultSample as never);
  });

  it("401 sans token", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/games/igdb/search?q=halo" });
    expect(res.statusCode).toBe(401);
    expect(searchSpy).not.toHaveBeenCalled();
  });

  it("200 avec q, appelle le service avec la query, le user et le defaut limit=12", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({ sub: "u", role: "user" });
    const res = await app.inject({
      method: "GET",
      url: "/api/games/igdb/search?q=halo",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ items: searchResultSample });
    expect(searchSpy).toHaveBeenCalledWith("halo", "u", 12);
  });

  it("passe le limit custom au service", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({ sub: "u", role: "user" });
    const res = await app.inject({
      method: "GET",
      url: "/api/games/igdb/search?q=halo&limit=5",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(searchSpy).toHaveBeenCalledWith("halo", "u", 5);
  });

  it("400 si q manquant", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({ sub: "u", role: "user" });
    const res = await app.inject({
      method: "GET",
      url: "/api/games/igdb/search",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
    expect(searchSpy).not.toHaveBeenCalled();
  });

  it("400 si limit hors bornes", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({ sub: "u", role: "user" });
    const res = await app.inject({
      method: "GET",
      url: "/api/games/igdb/search?q=halo&limit=100",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
    expect(searchSpy).not.toHaveBeenCalled();
  });

  it("502 si IGDB est indisponible", async () => {
    searchSpy.mockRejectedValueOnce(new Error("IGDB games a repondu HTTP 500"));
    const app = await buildApp();
    const token = app.jwt.sign({ sub: "u", role: "user" });
    const res = await app.inject({
      method: "GET",
      url: "/api/games/igdb/search?q=halo",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(502);
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";
import { validatorCompiler, serializerCompiler } from "fastify-type-provider-zod";
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
  it("lance pool A (search) puis pool B (where name~), fusionne et deduplique par id", async () => {
    const fetchMock = vi
      .fn()
      // Pool A (search) : contient 101, deja vu.
      .mockResolvedValueOnce(
        ok([
          {
            id: 101,
            name: "Halo",
            cover: { image_id: "cov1" },
            first_release_date: 1000000000,
            platforms: [6, 48],
            game_type: 0,
            total_rating_count: 340,
            hypes: 12,
          },
        ]),
      )
      // Pool B (where name~) : 101 en doublon (a dedupliquer) + 202 nouveau.
      .mockResolvedValueOnce(
        ok([
          { id: 101, name: "Halo", game_type: 0, total_rating_count: 340 },
          { id: 202, name: "Halo Wars", game_type: 0, total_rating_count: 900, hypes: 3 },
        ]),
      );

    const results = await searchGamesByName("Halo", 50, "TOKEN", "CID", fetchMock);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.igdbId).sort()).toEqual([101, 202]);
    // 101 vient du pool A (premier vu) : ses champs ne sont pas ecrases par le doublon du pool B.
    expect(results.find((r) => r.igdbId === 101)).toEqual({
      igdbId: 101,
      name: "Halo",
      coverImageId: "cov1",
      firstReleaseDate: 1000000000,
      platformIds: [6, 48],
      gameType: 0,
      totalRatingCount: 340,
      hypes: 12,
      versionParent: null,
    });
    expect(results.find((r) => r.igdbId === 202)).toEqual({
      igdbId: 202,
      name: "Halo Wars",
      coverImageId: null,
      firstReleaseDate: null,
      platformIds: [],
      gameType: 0,
      totalRatingCount: 900,
      hypes: 3,
      versionParent: null,
    });

    const poolAInit = fetchMock.mock.calls[0][1];
    expect(poolAInit.headers["Client-ID"]).toBe("CID");
    expect(poolAInit.headers["Authorization"]).toBe("Bearer TOKEN");
    expect(poolAInit.body).toContain('search "Halo";');
    expect(poolAInit.body).toContain(
      "fields name,cover.image_id,first_release_date,platforms,game_type,total_rating_count,hypes,version_parent;",
    );
    expect(poolAInit.body).toContain("limit 50;");
    expect(poolAInit.body).not.toContain("where");

    const poolBInit = fetchMock.mock.calls[1][1];
    expect(poolBInit.body).toContain('where name ~ *"Halo"* & game_type = (0,4,8,9,10,11) & version_parent = null;');
    expect(poolBInit.body).toContain("sort total_rating_count desc;");
    expect(poolBInit.body).toContain("limit 50;");
    expect(poolBInit.body).not.toContain("search ");
  });

  it("decoupe une requete multi-mots en conditions name~ jointes par AND (pool B)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(ok([])).mockResolvedValueOnce(ok([]));
    await searchGamesByName("assassins creed", 50, "TOKEN", "CID", fetchMock);

    const poolBInit = fetchMock.mock.calls[1][1];
    expect(poolBInit.body).toContain('name ~ *"assassins"* & name ~ *"creed"*');
  });

  it("echappe les guillemets et backslash dans le nom recherche (pool A)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(ok([])).mockResolvedValueOnce(ok([]));
    await searchGamesByName('The "Master" Chief\\', 12, "TOKEN", "CID", fetchMock);
    const poolAInit = fetchMock.mock.calls[0][1];
    expect(poolAInit.body).toContain('search "The \\"Master\\" Chief\\\\";');
  });

  it("echappe les guillemets et backslash mot par mot dans les conditions du pool B", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(ok([])).mockResolvedValueOnce(ok([]));
    await searchGamesByName('The "Master" Chief\\', 12, "TOKEN", "CID", fetchMock);

    const poolBInit = fetchMock.mock.calls[1][1];
    const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const expectedConds = ["The", '"Master"', "Chief\\"]
      .map((w) => `name ~ *"${escape(w)}"*`)
      .join(" & ");
    expect(poolBInit.body).toContain(expectedConds);
  });

  it("sans mot exploitable (requete vide apres trim), saute le pool B et n'appelle IGDB qu'une fois", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(ok([]));
    await searchGamesByName("   ", 12, "TOKEN", "CID", fetchMock);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("tolere les champs absents (cover, date, plateformes, game_type, total_rating_count, hypes, version_parent manquants)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok([{ id: 5, name: "Bare" }]))
      .mockResolvedValueOnce(ok([]));
    const [g] = await searchGamesByName("Bare", 12, "TOKEN", "CID", fetchMock);
    expect(g).toEqual({
      igdbId: 5,
      name: "Bare",
      coverImageId: null,
      firstReleaseDate: null,
      platformIds: [],
      gameType: null,
      totalRatingCount: null,
      hypes: null,
      versionParent: null,
    });
  });

  it("leve si IGDB repond non-200 (pool A)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(err(500));
    await expect(searchGamesByName("Halo", 12, "T", "C", fetchMock)).rejects.toThrow(/500/);
  });

  // Cas remonte par l'E2E reel : `where name ~ *"assassins"*` ne matche jamais
  // "Assassin's Creed" (l'apostrophe casse le filtre substring cote IGDB), alors
  // que le pool A (`search`, tokenise) le trouve. La fusion doit conserver ce
  // resultat meme si le pool B revient bredouille.
  it("garde un jeu remonte seulement par le pool A (apostrophe non matchee par le pool B)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        ok([{ id: 9999, name: "Assassin's Creed", game_type: 0, total_rating_count: 2000 }]),
      )
      .mockResolvedValueOnce(ok([]));

    const results = await searchGamesByName("assassins", 50, "TOKEN", "CID", fetchMock);

    expect(results.map((r) => r.igdbId)).toEqual([9999]);
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
    gameType: 0,
    totalRatingCount: 0,
    hypes: 0,
    versionParent: null,
  },
  {
    igdbId: 102,
    name: "Halo 2",
    coverImageId: null,
    firstReleaseDate: null,
    platformIds: [6],
    gameType: 0,
    totalRatingCount: 0,
    hypes: 0,
    versionParent: null,
  },
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

    const res = await searchIgdbGames("halo", "user-1", 12, undefined, "CID", deps);

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
    // Le pool de candidats bruts demande a IGDB est toujours de 50, independamment
    // du `limit` final demande par l'appelant (ici 12).
    // scope absent -> upcomingAfterEpoch = null (aucun filtre de date, comportement historique).
    expect(searchGamesByNameMock).toHaveBeenCalledWith("halo", 50, "TOKEN", "CID", null);
    // Union dedupliquee des platformIds de tous les resultats : une seule requete DB.
    expect(findPlatformsByIgdbIdsMock).toHaveBeenCalledWith([6, 48]);
    // La cle de cache integre le scope ("all" par defaut) : voir describe dedie plus bas.
    expect(cache.set).toHaveBeenCalledWith("igdb:search:v2:all:halo:12", expect.any(String), "EX", 3600);
    // Le cache ne stocke pas alreadyInCollection (specifique a l'utilisateur) ni
    // les plateformes mappees (recalculees a chaque lecture, nos plateformes
    // pouvant evoluer independamment du TTL de la recherche). Il stocke en
    // revanche gameType/totalRatingCount/hypes : le filtrage/classement se fait
    // apres lecture du cache, pas avant.
    const cached = JSON.parse(cache.store.get("igdb:search:v2:all:halo:12") as string);
    expect(cached[0].alreadyInCollection).toBeUndefined();
    expect(cached[0].platforms).toBeUndefined();
    expect(cached[0].platformIds).toEqual([6, 48]);
    expect(cached[0].gameType).toBe(0);
  });

  it("cache hit: renvoie le cache sans appeler IGDB, mais remappe les plateformes depuis la BDD", async () => {
    const cache = fakeCache();
    cache.store.set(
      "igdb:search:v2:all:zelda:12",
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

    const res = await searchIgdbGames("zelda", "user-1", 12, undefined, "CID", deps);

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

    const res = await searchIgdbGames("halo", "user-1", 12, undefined, "CID", deps);

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

    const res = await searchIgdbGames("halo", "user-1", 12, undefined, "CID", deps);

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

    await expect(searchIgdbGames("halo", "user-1", 12, undefined, "CID", deps)).rejects.toThrow(/503/);
    expect(cache.set).not.toHaveBeenCalled();
  });
});

describe("searchIgdbGames - scope upcoming", () => {
  it("scope=upcoming : cle de cache distincte et epoch calcule depuis l'horloge injectee", async () => {
    const cache = fakeCache();
    const searchGamesByNameMock = vi.fn(async () => searchSample);
    const deps = {
      getToken: vi.fn(async () => "TOKEN"),
      fetchUpcoming: vi.fn(),
      fetchGameDetail: vi.fn(),
      fetchGamesByIds: vi.fn(),
      fetchGamesByDeveloper: vi.fn(),
      searchGamesByName: searchGamesByNameMock,
      findOwnedIgdbIds: vi.fn(async () => new Set<number>()),
      findPlatformsByIgdbIds: vi.fn(async () => localPlatforms),
      cache,
      now: () => FIXED_NOW,
    } as unknown as DiscoveryDeps;

    await searchIgdbGames("halo", "user-1", 12, "upcoming", "CID", deps);

    const expectedEpoch = Math.floor(FIXED_NOW.getTime() / 1000);
    expect(searchGamesByNameMock).toHaveBeenCalledWith("halo", 50, "TOKEN", "CID", expectedEpoch);
    expect(cache.set).toHaveBeenCalledWith("igdb:search:v2:upcoming:halo:12", expect.any(String), "EX", 3600);
  });

  it("scope=upcoming et scope absent ne partagent jamais le meme pool en cache", async () => {
    const cache = fakeCache();
    // Le cache contient deja un pool "all" pour la meme query/limit : un
    // cache hit sur scope=upcoming ne doit jamais le reutiliser.
    cache.store.set("igdb:search:v2:all:halo:12", JSON.stringify(searchSample));
    const searchGamesByNameMock = vi.fn(async () => searchSample);
    const deps = {
      getToken: vi.fn(async () => "TOKEN"),
      fetchUpcoming: vi.fn(),
      fetchGameDetail: vi.fn(),
      fetchGamesByIds: vi.fn(),
      fetchGamesByDeveloper: vi.fn(),
      searchGamesByName: searchGamesByNameMock,
      findOwnedIgdbIds: vi.fn(async () => new Set<number>()),
      findPlatformsByIgdbIds: vi.fn(async () => localPlatforms),
      cache,
      now: () => FIXED_NOW,
    } as unknown as DiscoveryDeps;

    await searchIgdbGames("halo", "user-1", 12, "upcoming", "CID", deps);

    // Cache miss sur la cle scope=upcoming -> IGDB est bien rappele.
    expect(searchGamesByNameMock).toHaveBeenCalled();
  });
});

// Helper : construit un candidat IgdbSearchGame minimal pour les tests de
// filtrage/classement, avec des defauts neutres (pas de cover/date/plateforme).
function candidate(overrides: Partial<IgdbSearchGame> & { igdbId: number; name: string }): IgdbSearchGame {
  return {
    coverImageId: null,
    firstReleaseDate: null,
    platformIds: [],
    gameType: 0,
    totalRatingCount: 0,
    hypes: 0,
    versionParent: null,
    ...overrides,
  };
}

function depsWithPool(pool: IgdbSearchGame[]) {
  return {
    getToken: vi.fn(async () => "TOKEN"),
    fetchUpcoming: vi.fn(),
    fetchGameDetail: vi.fn(),
    fetchGamesByIds: vi.fn(),
    fetchGamesByDeveloper: vi.fn(),
    searchGamesByName: vi.fn(async () => pool),
    findOwnedIgdbIds: vi.fn(async () => new Set<number>()),
    findPlatformsByIgdbIds: vi.fn(async () => []),
    cache: fakeCache(),
    now: () => FIXED_NOW,
  } as unknown as DiscoveryDeps;
}

describe("searchIgdbGames - pool, filtrage et classement", () => {
  it("recupere toujours un pool de 50 candidats aupres d'IGDB, quel que soit le limit demande", async () => {
    const deps = depsWithPool([]);

    await searchIgdbGames("halo", "user-1", 5, undefined, "CID", deps);

    expect(deps.searchGamesByName).toHaveBeenCalledWith("halo", 50, "TOKEN", "CID", null);
  });

  it("exclut les DLC/bundles/packs (game_type) mais garde un candidat sans game_type connu", async () => {
    const pool = [
      candidate({ igdbId: 1, name: "Base Game", gameType: 0 }), // main_game : garde
      candidate({ igdbId: 2, name: "Base Game DLC", gameType: 1 }), // dlc : exclu
      candidate({ igdbId: 3, name: "Base Game Bundle", gameType: 3 }), // bundle : exclu
      candidate({ igdbId: 4, name: "Base Game Pack", gameType: 13 }), // pack : exclu
      candidate({ igdbId: 5, name: "Unknown Type Game", gameType: null }), // inconnu : garde par prudence
    ];
    const deps = depsWithPool(pool);

    const res = await searchIgdbGames("base game", "user-1", 18, undefined, "CID", deps);

    const ids = res.map((r) => r.igdbId);
    expect(ids).toContain(1);
    expect(ids).toContain(5);
    expect(ids).not.toContain(2);
    expect(ids).not.toContain(3);
    expect(ids).not.toContain(4);
  });

  it("exclut une edition (version_parent renseigne) meme avec un game_type autorise", async () => {
    const pool = [
      candidate({ igdbId: 1, name: "Base Game", gameType: 0, versionParent: null }), // jeu de base : garde
      candidate({ igdbId: 2, name: "Base Game Ultimate Edition", gameType: 0, versionParent: 1 }), // edition : exclue
    ];
    const deps = depsWithPool(pool);

    const res = await searchIgdbGames("base game", "user-1", 18, undefined, "CID", deps);

    const ids = res.map((r) => r.igdbId);
    expect(ids).toContain(1);
    expect(ids).not.toContain(2);
  });

  it("classe un jeu bien note avant un jeu obscur, a tier de correspondance de nom egal (aucun des deux exact)", async () => {
    const pool = [
      candidate({ igdbId: 1, name: "Obscure Quest Saga", totalRatingCount: 0, hypes: 0 }),
      candidate({ igdbId: 2, name: "Popular Quest Journey", totalRatingCount: 800, hypes: 50 }),
    ];
    const deps = depsWithPool(pool);

    const res = await searchIgdbGames("quest", "user-1", 18, undefined, "CID", deps);

    expect(res.map((r) => r.igdbId)).toEqual([2, 1]);
  });

  // Pure popularite : un match exact du nom mais peu populaire NE prime PAS sur le
  // jeu canonique plus populaire (cas reel "Zelda" 1989 exact vs Breath of the Wild).
  it("classe par pure popularite, meme quand un candidat est un match exact du nom", async () => {
    const pool = [
      candidate({ igdbId: 1, name: "Zelda", totalRatingCount: 730, hypes: 0 }),
      candidate({
        igdbId: 2,
        name: "The Legend of Zelda: Breath of the Wild",
        totalRatingCount: 2943,
        hypes: 0,
      }),
    ];
    const deps = depsWithPool(pool);

    const res = await searchIgdbGames("zelda", "user-1", 18, undefined, "CID", deps);

    expect(res[0]?.igdbId).toBe(2);
  });

  // Cas remonte par l'E2E reel : le titre complet d'un jeu tres connu ne contient
  // pas toujours litteralement la requete tapee (ex. "gta" absent de "Grand Theft
  // Auto: San Andreas"). Comme aucun des deux ne matche exactement, seule la
  // popularite (total_rating_count) doit decider : le jeu connu doit passer devant
  // un titre obscur qui, lui, contient le texte tape mot pour mot.
  it("classe un jeu tres note dont le nom ne contient pas la requete avant un obscur qui la contient", async () => {
    const pool = [
      candidate({ igdbId: 1, name: "Grand Theft Auto: San Andreas", totalRatingCount: 3988, hypes: 0 }),
      candidate({ igdbId: 2, name: "GTA La Heist", totalRatingCount: 0, hypes: 0 }),
    ];
    const deps = depsWithPool(pool);

    const res = await searchIgdbGames("gta", "user-1", 18, undefined, "CID", deps);

    expect(res.map((r) => r.igdbId)).toEqual([1, 2]);
  });

  it("coupe au top N apres classement par popularite", async () => {
    // Meme tier pour tous (aucun match exact), popularite decroissante avec l'id.
    const pool = Array.from({ length: 6 }, (_, i) =>
      candidate({
        igdbId: i + 1,
        name: `Quest Game ${i + 1}`,
        totalRatingCount: 6 - i,
        hypes: 0,
      }),
    );
    const deps = depsWithPool(pool);

    const res = await searchIgdbGames("quest", "user-1", 3, undefined, "CID", deps);

    expect(res).toHaveLength(3);
    expect(res.map((r) => r.igdbId)).toEqual([1, 2, 3]);
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
  app.setSerializerCompiler(serializerCompiler);
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

  it("200 avec q, appelle le service avec la query, le user et le defaut limit=18", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({ sub: "u", role: "user" });
    const res = await app.inject({
      method: "GET",
      url: "/api/games/igdb/search?q=halo",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ items: searchResultSample });
    // scope absent de la querystring -> undefined transmis tel quel au service.
    expect(searchSpy).toHaveBeenCalledWith("halo", "u", 18, undefined);
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
    expect(searchSpy).toHaveBeenCalledWith("halo", "u", 5, undefined);
  });

  it("passe scope=upcoming au service", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({ sub: "u", role: "user" });
    const res = await app.inject({
      method: "GET",
      url: "/api/games/igdb/search?q=halo&scope=upcoming",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(searchSpy).toHaveBeenCalledWith("halo", "u", 18, "upcoming");
  });

  it("400 si scope a une valeur inconnue", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({ sub: "u", role: "user" });
    const res = await app.inject({
      method: "GET",
      url: "/api/games/igdb/search?q=halo&scope=released",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
    expect(searchSpy).not.toHaveBeenCalled();
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

import { describe, it, expect, vi } from "vitest";
import {
  getUpcomingGames,
  getGameDetail,
  type DiscoveryDeps,
} from "../igdb.discovery.service.js";
import type { IgdbUpcomingGame, IgdbGameDetail } from "../igdb.client.js";

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

const upcomingSample: IgdbUpcomingGame = {
  igdbId: 1,
  name: "Game One",
  releaseDate: "2027-01-01",
  coverImageId: "cov1",
  hypes: 100,
  genres: [{ igdbId: 12, name: "RPG", slug: "rpg" }],
  platforms: [{ igdbId: 6, name: "PC", abbreviation: "PC" }],
};

const detailSample: IgdbGameDetail = {
  igdbId: 1020,
  name: "GTA V",
  summary: "Open world.",
  storyline: null,
  releaseDate: "2013-09-17",
  rating: 92,
  ratingCount: 1500,
  hypes: 10,
  coverImageId: "cov",
  artworkImageId: "art",
  screenshotImageIds: ["ss1"],
  videos: [{ name: "Trailer", youtubeId: "yt" }],
  developer: "Rockstar North",
  publisher: "Rockstar Games",
  genres: [],
  themes: [],
  gameModes: [],
  playerPerspectives: [],
  platforms: [],
  websites: [],
  similarGames: [{ igdbId: 11, name: "Sim", coverImageId: "sc" }],
};

const FIXED_NOW = new Date("2026-06-22T00:00:00Z");

describe("getUpcomingGames", () => {
  it("cache miss: appelle IGDB (token + nowEpoch), mappe en DTO, ecrit le cache 1h", async () => {
    const cache = fakeCache();
    const fetchUpcoming = vi.fn(async () => [upcomingSample]);
    const deps = {
      getToken: vi.fn(async () => "TOKEN"),
      fetchUpcoming,
      fetchGameDetail: vi.fn(),
      cache,
      now: () => FIXED_NOW,
    } as unknown as DiscoveryDeps;

    const res = await getUpcomingGames({ limit: 20, offset: 0, sort: "hype" }, "CID", deps);

    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ igdbId: 1, title: "Game One", hypes: 100 });
    expect(res[0].coverUrl).toContain("t_cover_big/cov1.jpg");
    expect(fetchUpcoming).toHaveBeenCalledWith(
      { limit: 20, offset: 0, sort: "hype" },
      Math.floor(FIXED_NOW.getTime() / 1000),
      "TOKEN",
      "CID",
    );
    expect(cache.set).toHaveBeenCalledWith(
      "igdb:upcoming:hype:20:0",
      expect.any(String),
      "EX",
      3600,
    );
  });

  it("cache hit: renvoie le cache sans appeler IGDB", async () => {
    const cache = fakeCache();
    cache.store.set(
      "igdb:upcoming:date:10:5",
      JSON.stringify([{ igdbId: 9, title: "Cached" }]),
    );
    const fetchUpcoming = vi.fn();
    const deps = {
      getToken: vi.fn(),
      fetchUpcoming,
      fetchGameDetail: vi.fn(),
      cache,
      now: () => FIXED_NOW,
    } as unknown as DiscoveryDeps;

    const res = await getUpcomingGames({ limit: 10, offset: 5, sort: "date" }, "CID", deps);

    expect(res).toEqual([{ igdbId: 9, title: "Cached" }]);
    expect(fetchUpcoming).not.toHaveBeenCalled();
  });

  it("propage l'erreur si IGDB echoue et n'ecrit pas le cache", async () => {
    const cache = fakeCache();
    const deps = {
      getToken: vi.fn(async () => "T"),
      fetchUpcoming: vi.fn(async () => {
        throw new Error("IGDB 503");
      }),
      fetchGameDetail: vi.fn(),
      cache,
      now: () => FIXED_NOW,
    } as unknown as DiscoveryDeps;

    await expect(
      getUpcomingGames({ limit: 20, offset: 0, sort: "hype" }, "CID", deps),
    ).rejects.toThrow(/503/);
    expect(cache.set).not.toHaveBeenCalled();
  });
});

describe("getGameDetail", () => {
  it("cache miss: appelle IGDB, mappe en DTO riche, ecrit le cache 24h", async () => {
    const cache = fakeCache();
    const fetchGameDetail = vi.fn(async () => detailSample);
    const deps = {
      getToken: vi.fn(async () => "TOKEN"),
      fetchUpcoming: vi.fn(),
      fetchGameDetail,
      cache,
      now: () => FIXED_NOW,
    } as unknown as DiscoveryDeps;

    const res = await getGameDetail(1020, "CID", deps);

    expect(res).not.toBeNull();
    expect(res!.title).toBe("GTA V");
    expect(res!.releaseStatus).toBe("released");
    expect(res!.screenshots[0]).toContain("t_screenshot_big/ss1.jpg");
    expect(res!.similarGames[0]).toMatchObject({ igdbId: 11, title: "Sim" });
    expect(fetchGameDetail).toHaveBeenCalledWith(1020, "TOKEN", "CID");
    expect(cache.set).toHaveBeenCalledWith(
      "igdb:game:1020",
      expect.any(String),
      "EX",
      86400,
    );
  });

  it("cache hit: renvoie le cache sans appeler IGDB", async () => {
    const cache = fakeCache();
    cache.store.set("igdb:game:5", JSON.stringify({ igdbId: 5, title: "Cached" }));
    const fetchGameDetail = vi.fn();
    const deps = {
      getToken: vi.fn(),
      fetchUpcoming: vi.fn(),
      fetchGameDetail,
      cache,
      now: () => FIXED_NOW,
    } as unknown as DiscoveryDeps;

    const res = await getGameDetail(5, "CID", deps);

    expect(res).toMatchObject({ igdbId: 5, title: "Cached" });
    expect(fetchGameDetail).not.toHaveBeenCalled();
  });

  it("renvoie null et ne cache pas si le jeu est introuvable sur IGDB", async () => {
    const cache = fakeCache();
    const deps = {
      getToken: vi.fn(async () => "T"),
      fetchUpcoming: vi.fn(),
      fetchGameDetail: vi.fn(async () => null),
      cache,
      now: () => FIXED_NOW,
    } as unknown as DiscoveryDeps;

    const res = await getGameDetail(404404, "CID", deps);

    expect(res).toBeNull();
    expect(cache.set).not.toHaveBeenCalled();
  });
});

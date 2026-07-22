import { describe, it, expect, vi } from "vitest";
import {
  findGameIdsBySteamAppids,
  fetchGamesByIds,
  fetchTimeToBeats,
  fetchUpcomingByGenres,
  fetchUpcoming,
  fetchGameDetail,
  igdbImageUrl,
  mapRawGame,
} from "../igdb.client.js";

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const err = (status: number) => ({ ok: false, status, json: async () => ({}) });

describe("igdbImageUrl", () => {
  it("construit l'URL CDN a partir de l'image_id et de la taille", () => {
    expect(igdbImageUrl("abc123", "t_cover_big")).toBe(
      "https://images.igdb.com/igdb/image/upload/t_cover_big/abc123.jpg",
    );
  });
});

describe("findGameIdsBySteamAppids", () => {
  it("mappe appid -> igdbId via external_games", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      ok([
        { id: 1, game: 1020, uid: "570" },
        { id: 2, game: 7346, uid: "730" },
      ]),
    );

    const map = await findGameIdsBySteamAppids([570, 730], "TOKEN", "CID", fetchMock);

    expect(map.get(570)).toBe(1020);
    expect(map.get(730)).toBe(7346);
    // En-tetes d'auth presents
    const init = fetchMock.mock.calls[0][1];
    expect(init.headers["Client-ID"]).toBe("CID");
    expect(init.headers["Authorization"]).toBe("Bearer TOKEN");
    // Le corps est une requete Apicalypse qui filtre sur la source Steam et les uid demandes
    expect(init.body).toContain("external_game_source = 1");
    expect(init.body).toMatch(/uid = \("570","730"\)/);
  });

  it("renvoie une map vide pour une liste vide (aucun appel)", async () => {
    const fetchMock = vi.fn();
    const map = await findGameIdsBySteamAppids([], "TOKEN", "CID", fetchMock);
    expect(map.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("leve si IGDB repond non-200", async () => {
    const fetchMock = vi.fn().mockResolvedValue(err(500));
    await expect(
      findGameIdsBySteamAppids([570], "TOKEN", "CID", fetchMock),
    ).rejects.toThrow(/500/);
  });
});

describe("fetchGamesByIds", () => {
  it("parse les champs IGDB en objet typé", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      ok([
        {
          id: 1020,
          name: "Grand Theft Auto V",
          summary: "Open world.",
          first_release_date: 1379376000,
          rating: 92.3,
          rating_count: 1500,
          cover: { id: 1, image_id: "cover123" },
          artworks: [{ id: 9, image_id: "art456" }],
          genres: [{ id: 5, name: "Shooter", slug: "shooter" }],
          themes: [{ id: 1, name: "Action", slug: "action" }],
          involved_companies: [
            { company: { name: "Rockstar North" }, developer: true, publisher: false },
            { company: { name: "Rockstar Games" }, developer: false, publisher: true },
          ],
          similar_games: [11, 22, 33],
        },
      ]),
    );

    const [g] = await fetchGamesByIds([1020], "TOKEN", "CID", fetchMock);

    expect(g.igdbId).toBe(1020);
    expect(g.name).toBe("Grand Theft Auto V");
    expect(g.summary).toBe("Open world.");
    expect(g.releaseDate).toBe("2013-09-17");
    expect(g.rating).toBe(92.3);
    expect(g.ratingCount).toBe(1500);
    expect(g.coverImageId).toBe("cover123");
    expect(g.artworkImageId).toBe("art456");
    expect(g.genres).toEqual([{ igdbId: 5, name: "Shooter", slug: "shooter" }]);
    expect(g.themes).toEqual([{ igdbId: 1, name: "Action", slug: "action" }]);
    expect(g.developer).toBe("Rockstar North");
    expect(g.publisher).toBe("Rockstar Games");
    expect(g.similarIgdbIds).toEqual([11, 22, 33]);
  });

  it("tolère les champs absents (jeu minimal)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([{ id: 99, name: "X" }]));
    const [g] = await fetchGamesByIds([99], "TOKEN", "CID", fetchMock);
    expect(g.igdbId).toBe(99);
    expect(g.releaseDate).toBeNull();
    expect(g.coverImageId).toBeNull();
    expect(g.genres).toEqual([]);
    expect(g.similarIgdbIds).toEqual([]);
  });
});

describe("mapRawGame", () => {
  it("capte platformIds, gameType et versionParentIgdbId", () => {
    const raw = {
      id: 42, name: "Test", platforms: [6, 48], game_type: 0, version_parent: null,
    } as any;
    const mapped = mapRawGame(raw);
    expect(mapped.platformIds).toEqual([6, 48]);
    expect(mapped.gameType).toBe(0);
    expect(mapped.versionParentIgdbId).toBeNull();
  });
});

describe("fetchUpcomingByGenres", () => {
  it("filtre par date de sortie future, genres et ordonne par hype desc (IGDB passthrough)", async () => {
    const nowEpoch = 1700000000;
    const fetchMock = vi.fn().mockResolvedValue(
      ok([
        {
          id: 1002,
          name: "Upcoming Game 2",
          summary: "Even more anticipated.",
          first_release_date: nowEpoch + 86400 * 60,
          rating: null,
          rating_count: null,
          cover: { id: 2, image_id: "upcover2" },
          artworks: [{ id: 11, image_id: "upart2" }],
          genres: [{ id: 12, name: "RPG", slug: "rpg" }],
          themes: [],
          involved_companies: [
            { company: { name: "Dev Inc 2" }, developer: true, publisher: false },
          ],
          similar_games: [],
          hypes: 800, // Rang plus haut (premiere position apres sort desc)
        },
        {
          id: 1001,
          name: "Upcoming Game 1",
          summary: "Anticipated.",
          first_release_date: nowEpoch + 86400 * 30, // 30 jours dans le futur
          rating: null,
          rating_count: null,
          cover: { id: 1, image_id: "upcover1" },
          artworks: [{ id: 10, image_id: "upart1" }],
          genres: [{ id: 12, name: "RPG", slug: "rpg" }],
          themes: [],
          involved_companies: [
            { company: { name: "Dev Inc" }, developer: true, publisher: false },
          ],
          similar_games: [],
          hypes: 500, // Rang plus bas
        },
      ]),
    );

    const games = await fetchUpcomingByGenres([12], nowEpoch, "TOKEN", "CID", fetchMock);

    expect(games).toHaveLength(2);
    // Client passes IGDB response through unchanged, respecting IGDB's "sort hypes desc"
    expect(games[0].name).toBe("Upcoming Game 2");
    expect(games[0].hypes).toBe(800);
    expect(games[1].name).toBe("Upcoming Game 1");
    expect(games[1].hypes).toBe(500);

    // Verifie la requete Apicalypse
    const init = fetchMock.mock.calls[0][1];
    expect(init.body).toContain(`first_release_date > ${nowEpoch}`);
    expect(init.body).toContain("genres = (12)");
    expect(init.body).toContain("sort hypes desc");
    expect(init.body).toContain("limit 60");
  });

  it("renvoie une liste vide si aucun genre donné", async () => {
    const fetchMock = vi.fn();
    const games = await fetchUpcomingByGenres([], 1700000000, "TOKEN", "CID", fetchMock);
    expect(games).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("parse les jeux a venir et gere les champs optionnels", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      ok([
        {
          id: 2001,
          name: "Mystery Game",
          // Pas de summary, rating, artworks
          first_release_date: 1800000000,
          genres: [],
        },
      ]),
    );

    const [g] = await fetchUpcomingByGenres([5, 10], 1700000000, "TOKEN", "CID", fetchMock);

    expect(g.igdbId).toBe(2001);
    expect(g.name).toBe("Mystery Game");
    expect(g.summary).toBeNull();
    expect(g.rating).toBeNull();
    expect(g.artworkImageId).toBeNull();
    expect(g.genres).toEqual([]);
  });

  it("leve si IGDB repond non-200", async () => {
    const fetchMock = vi.fn().mockResolvedValue(err(500));
    await expect(
      fetchUpcomingByGenres([12], 1700000000, "TOKEN", "CID", fetchMock),
    ).rejects.toThrow(/500/);
  });
});

describe("fetchUpcoming", () => {
  it("filtre date future, trie par hype desc par defaut, mappe genres+plateformes", async () => {
    const now = 1700000000;
    const fetchMock = vi.fn().mockResolvedValue(
      ok([
        {
          id: 3001,
          name: "Hyped Game",
          first_release_date: now + 86400 * 10,
          hypes: 900,
          cover: { id: 1, image_id: "cov1" },
          genres: [{ id: 12, name: "RPG", slug: "rpg" }],
          platforms: [
            { id: 6, name: "PC (Microsoft Windows)", abbreviation: "PC" },
            { id: 48, name: "PlayStation 5", abbreviation: "PS5" },
          ],
        },
      ]),
    );

    const games = await fetchUpcoming(
      { limit: 20, offset: 0, sort: "hype" },
      now,
      "TOKEN",
      "CID",
      fetchMock,
    );

    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({
      igdbId: 3001,
      name: "Hyped Game",
      coverImageId: "cov1",
      hypes: 900,
    });
    expect(games[0].releaseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(games[0].genres).toEqual([{ igdbId: 12, name: "RPG", slug: "rpg" }]);
    expect(games[0].platforms).toEqual([
      { igdbId: 6, name: "PC (Microsoft Windows)", abbreviation: "PC" },
      { igdbId: 48, name: "PlayStation 5", abbreviation: "PS5" },
    ]);

    const init = fetchMock.mock.calls[0][1];
    expect(init.body).toContain(`first_release_date > ${now}`);
    expect(init.body).toContain("sort hypes desc");
    expect(init.body).toContain("limit 20");
    expect(init.body).toContain("offset 0");
    expect(init.body).toContain("platforms.abbreviation");
  });

  it("trie par date asc quand sort=date et passe limit/offset", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([]));
    await fetchUpcoming({ limit: 10, offset: 5, sort: "date" }, 1700000000, "T", "C", fetchMock);
    const init = fetchMock.mock.calls[0][1];
    expect(init.body).toContain("sort first_release_date asc");
    expect(init.body).toContain("limit 10");
    expect(init.body).toContain("offset 5");
  });

  it("tolere les champs absents (jeu minimal)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([{ id: 1, name: "Bare" }]));
    const [g] = await fetchUpcoming(
      { limit: 20, offset: 0, sort: "hype" },
      1,
      "T",
      "C",
      fetchMock,
    );
    expect(g.coverImageId).toBeNull();
    expect(g.genres).toEqual([]);
    expect(g.platforms).toEqual([]);
    expect(g.hypes).toBeNull();
  });

  it("leve si IGDB repond non-200", async () => {
    const fetchMock = vi.fn().mockResolvedValue(err(503));
    await expect(
      fetchUpcoming({ limit: 20, offset: 0, sort: "hype" }, 1, "T", "C", fetchMock),
    ).rejects.toThrow(/503/);
  });
});

describe("fetchGameDetail", () => {
  it("mappe le detail riche (screenshots, videos, plateformes, modes, similar)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      ok([
        {
          id: 1020,
          name: "GTA V",
          summary: "Open world.",
          storyline: "Three criminals.",
          first_release_date: 1379376000,
          rating: 92.3,
          rating_count: 1500,
          hypes: 10,
          cover: { image_id: "cov" },
          artworks: [{ image_id: "art" }],
          screenshots: [{ image_id: "ss1" }, { image_id: "ss2" }],
          videos: [
            { video_id: "yt123", name: "Trailer" },
            { name: "sans id" },
          ],
          genres: [{ id: 5, name: "Shooter", slug: "shooter" }],
          themes: [{ id: 1, name: "Action", slug: "action" }],
          game_modes: [{ id: 1, name: "Single player", slug: "single-player" }],
          player_perspectives: [{ id: 1, name: "First person", slug: "first-person" }],
          platforms: [{ id: 6, name: "PC", abbreviation: "PC" }],
          websites: [
            { category: 1, url: "https://official" },
            { category: 13, url: "https://steam" },
          ],
          involved_companies: [
            { company: { name: "Rockstar North" }, developer: true, publisher: false },
            { company: { name: "Rockstar Games" }, developer: false, publisher: true },
          ],
          similar_games: [
            { id: 11, name: "Sim 1", cover: { image_id: "sc1" } },
            { id: 22, name: "Sim 2" },
          ],
        },
      ]),
    );

    const g = await fetchGameDetail(1020, "TOKEN", "CID", fetchMock);

    expect(g).not.toBeNull();
    expect(g!.igdbId).toBe(1020);
    expect(g!.summary).toBe("Open world.");
    expect(g!.storyline).toBe("Three criminals.");
    expect(g!.releaseDate).toBe("2013-09-17");
    expect(g!.coverImageId).toBe("cov");
    expect(g!.artworkImageId).toBe("art");
    expect(g!.screenshotImageIds).toEqual(["ss1", "ss2"]);
    // La video sans video_id est exclue.
    expect(g!.videos).toEqual([{ name: "Trailer", youtubeId: "yt123" }]);
    expect(g!.genres).toEqual([{ igdbId: 5, name: "Shooter", slug: "shooter" }]);
    expect(g!.themes).toEqual([{ igdbId: 1, name: "Action", slug: "action" }]);
    expect(g!.gameModes).toEqual([{ igdbId: 1, name: "Single player", slug: "single-player" }]);
    expect(g!.playerPerspectives).toEqual([
      { igdbId: 1, name: "First person", slug: "first-person" },
    ]);
    expect(g!.platforms).toEqual([{ igdbId: 6, name: "PC", abbreviation: "PC" }]);
    expect(g!.websites).toEqual([
      { category: 1, url: "https://official" },
      { category: 13, url: "https://steam" },
    ]);
    expect(g!.developer).toBe("Rockstar North");
    expect(g!.publisher).toBe("Rockstar Games");
    expect(g!.similarGames).toEqual([
      { igdbId: 11, name: "Sim 1", coverImageId: "sc1" },
      { igdbId: 22, name: "Sim 2", coverImageId: null },
    ]);

    const init = fetchMock.mock.calls[0][1];
    expect(init.body).toContain("where id = 1020");
    expect(init.body).toContain("screenshots.image_id");
    expect(init.body).toContain("similar_games.cover.image_id");
  });

  it("renvoie null si l'igdbId est introuvable", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([]));
    const g = await fetchGameDetail(999999, "T", "C", fetchMock);
    expect(g).toBeNull();
  });

  it("leve si IGDB repond non-200", async () => {
    const fetchMock = vi.fn().mockResolvedValue(err(500));
    await expect(fetchGameDetail(1, "T", "C", fetchMock)).rejects.toThrow(/500/);
  });
});

describe("fetchTimeToBeats", () => {
  it("convertit normally (secondes) en minutes et filtre count faible", async () => {
    const fakeFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => [
        { game_id: 1, normally: 7200, count: 40 }, // 120 min
        { game_id: 2, normally: 3600, count: 3 }, // count < 10 -> exclu
      ],
    });
    const map = await fetchTimeToBeats([1, 2], "tok", "cid", fakeFetch as never);
    expect(map.get(1)).toEqual({ normallyMinutes: 120, count: 40 });
    expect(map.has(2)).toBe(false);
  });
});

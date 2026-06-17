import { describe, it, expect, vi } from "vitest";
import {
  findGameIdsBySteamAppids,
  fetchGamesByIds,
  fetchTimeToBeats,
  fetchUpcomingByGenres,
  igdbImageUrl,
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

describe("fetchUpcomingByGenres", () => {
  it("filtre par date de sortie future, genres et ordonne par hype", async () => {
    const nowEpoch = 1700000000;
    const fetchMock = vi.fn().mockResolvedValue(
      ok([
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
          hypes: 500,
        },
        {
          id: 1002,
          name: "Upcoming Game 2",
          summary: "Even more anticipated.",
          first_release_date: nowEpoch + 86400 * 60,
          hypes: 800, // Rang plus haut
          genres: [{ id: 12, name: "RPG", slug: "rpg" }],
        },
      ]),
    );

    const games = await fetchUpcomingByGenres([12], nowEpoch, "TOKEN", "CID", fetchMock);

    expect(games).toHaveLength(2);
    expect(games[0].name).toBe("Upcoming Game 1");
    expect(games[0].hypes).toBe(500);
    expect(games[1].name).toBe("Upcoming Game 2");
    expect(games[1].hypes).toBe(800);

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

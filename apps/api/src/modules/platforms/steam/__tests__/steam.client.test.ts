import { describe, it, expect, vi } from "vitest";
import { getOwnedGames, getPlayerSummary } from "../steam.client.js";

// Helpers de reponse fetch mockee (200 par defaut, ou statut d'erreur).
const okResponse = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
});
const errorResponse = (status: number) => ({
  ok: false,
  status,
  json: async () => ({}),
});

describe("getOwnedGames", () => {
  it("mappe les jeux Steam (appid, nom, playtime en minutes)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okResponse({
        response: {
          game_count: 2,
          games: [
            { appid: 570, name: "Dota 2", playtime_forever: 1200 },
            { appid: 730, name: "CS2", playtime_forever: 0 },
          ],
        },
      }),
    );

    const games = await getOwnedGames("76561198000000000", "KEY", fetchMock);

    expect(games).toEqual([
      { appid: 570, name: "Dota 2", playtimeMinutes: 1200 },
      { appid: 730, name: "CS2", playtimeMinutes: 0 },
    ]);
  });

  it("construit l'URL avec la cle, le steamid et les params include", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse({ response: { games: [] } }));

    await getOwnedGames("76561198000000000", "SECRET_KEY", fetchMock);

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("IPlayerService/GetOwnedGames");
    expect(url).toContain("key=SECRET_KEY");
    expect(url).toContain("steamid=76561198000000000");
    expect(url).toContain("include_appinfo=1");
    expect(url).toContain("include_played_free_games=1");
  });

  it("renvoie un tableau vide quand le profil est prive (pas de games)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse({ response: {} }));

    expect(
      await getOwnedGames("76561198000000000", "KEY", fetchMock),
    ).toEqual([]);
  });

  it("leve une erreur si Steam repond un statut non-200", async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(500));

    await expect(
      getOwnedGames("76561198000000000", "KEY", fetchMock),
    ).rejects.toThrow(/500/);
  });
});

describe("getPlayerSummary", () => {
  it("renvoie le pseudo et l'avatar du joueur", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okResponse({
        response: {
          players: [
            {
              steamid: "76561198000000000",
              personaname: "Gaben",
              avatarfull: "https://avatars.steamstatic.com/x_full.jpg",
            },
          ],
        },
      }),
    );

    expect(
      await getPlayerSummary("76561198000000000", "KEY", fetchMock),
    ).toEqual({
      personaName: "Gaben",
      avatarUrl: "https://avatars.steamstatic.com/x_full.jpg",
    });
  });

  it("renvoie null quand aucun joueur n'est trouve", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse({ response: { players: [] } }));

    expect(
      await getPlayerSummary("76561198000000000", "KEY", fetchMock),
    ).toBeNull();
  });

  it("renvoie null (sans lever) si Steam repond un statut non-200", async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(503));

    expect(
      await getPlayerSummary("76561198000000000", "KEY", fetchMock),
    ).toBeNull();
  });
});

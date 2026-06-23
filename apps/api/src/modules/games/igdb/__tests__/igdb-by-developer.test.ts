import { describe, it, expect, vi } from "vitest";
import { fetchGamesByDeveloper } from "../igdb.client.js";

describe("fetchGamesByDeveloper", () => {
  it("résout la société par nom et retourne ses jeux développés, triés par note", async () => {
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      callCount++;
      // Premier appel : /companies
      if (url.includes("/companies")) {
        return {
          ok: true,
          status: 200,
          json: async () => [{ id: 765 }],
        };
      }
      // Deuxième appel : /games
      if (url.includes("/games")) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              id: 1,
              name: "Divinity OS2",
              summary: "Test",
              rating: 90,
              rating_count: 500,
            },
          ],
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const res = await fetchGamesByDeveloper("Larian Studios", "tok", "cid", fetchMock);

    expect(res.length).toBe(1);
    expect(res[0].name).toBe("Divinity OS2");

    // Vérifier que /companies a été appelé avec le nom du dev
    const companiesCall = fetchMock.mock.calls[0];
    const companiesBody = companiesCall[1].body as string;
    expect(companiesBody).toContain("Larian Studios");

    // Vérifier que /games a été appelé avec le filtre de société et de développeur
    const gamesCall = fetchMock.mock.calls[1];
    const gamesBody = gamesCall[1].body as string;
    expect(gamesBody).toContain("involved_companies.company = 765");
    expect(gamesBody).toContain("involved_companies.developer = true");
    expect(gamesBody).toContain("sort rating desc");
  });

  it("échappe les guillemets dans le nom du développeur", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/companies")) {
        return {
          ok: true,
          status: 200,
          json: async () => [{ id: 123 }],
        };
      }
      if (url.includes("/games")) {
        return {
          ok: true,
          status: 200,
          json: async () => [],
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    await fetchGamesByDeveloper('Studio "Test"', "tok", "cid", fetchMock);

    const companiesCall = fetchMock.mock.calls[0];
    const companiesBody = companiesCall[1].body as string;
    expect(companiesBody).toContain('Studio \\"Test\\"');
  });

  it("retourne [] si la société est introuvable (exact et fallback)", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/companies")) {
        return {
          ok: true,
          status: 200,
          json: async () => [],
        };
      }
      throw new Error("Should not call /games if company not found");
    });

    const res = await fetchGamesByDeveloper("Unknown Studio", "tok", "cid", fetchMock);

    expect(res.length).toBe(0);
    // Vérifier qu'on a appelé /companies deux fois (exact + fallback) mais pas /games
    expect(fetchMock.mock.calls.length).toBe(2);
    // Les deux appels doivent être à /companies
    expect(fetchMock.mock.calls[0][0]).toContain("/companies");
    expect(fetchMock.mock.calls[1][0]).toContain("/companies");
  });

  it("retourne [] si le nom du développeur est vide", async () => {
    const fetchMock = vi.fn();

    const res = await fetchGamesByDeveloper("", "tok", "cid", fetchMock);

    expect(res.length).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

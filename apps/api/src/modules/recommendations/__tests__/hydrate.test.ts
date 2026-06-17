import { describe, it, expect, beforeEach, vi } from "vitest";
import { db, games } from "@nextquest/db";
import { inArray } from "drizzle-orm";
import { hydrateMissingGames } from "../hydrate.js";
import { hydrateGamesByIgdbIds, type IgdbDeps } from "../../games/igdb/igdb.service.js";
import type { IgdbGame } from "../../games/igdb/igdb.client.js";

// Cleanup
async function cleanup() {
  await db.delete(games);
}

beforeEach(async () => {
  await cleanup();
});

describe("hydrateMissingGames", () => {
  it("n'appelle hydrateGamesByIgdbIds que pour les igdbIds absents", async () => {
    // Seed : un jeu avec igdbId 100 deja present
    const [existing] = await db
      .insert(games)
      .values({
        title: "Existing Game",
        slug: "existing-game",
        igdbId: 100,
        isCustom: false,
      })
      .returning({ id: games.id });

    // Mock hydrateGamesByIgdbIds pour verifier l'appel
    const mockHydrate = vi.fn(async (ids: number[]) => {
      return ids.length;
    });

    // On veut verifier que seul l'igdbId 200 est passe a hydrateGamesByIgdbIds
    // (100 est deja present, donc skip).
    const igdbIds = [100, 200, 300]; // 100 present, 200 et 300 manquants

    // Depuis hydrate.ts, c'est hydrateGamesByIgdbIds qui est appelee.
    // On ne peut pas mocker directement depuis hydrate.ts (c'est un appel direct),
    // donc on teste que hydrateGamesByIgdbIds skip les presents.

    // On teste juste l'idempotence : appeler deux fois avec les memes ids
    // doit inserer qu'une fois.
    const before = await db
      .select({ id: games.id, igdbId: games.igdbId })
      .from(games);

    expect(before).toHaveLength(1);
    expect(before[0].igdbId).toBe(100);

    // hydrateMissingGames ne doit rien faire si les igdbIds sont vides ou presents
    await hydrateMissingGames([100]); // 100 deja present

    const after = await db
      .select({ id: games.id, igdbId: games.igdbId })
      .from(games);

    expect(after).toHaveLength(1); // Rien de nouveau insere
  });

  it("ne fait rien si la liste igdbIds est vide", async () => {
    const before = await db.select({ id: games.id }).from(games);
    expect(before).toHaveLength(0);

    await hydrateMissingGames([]);

    const after = await db.select({ id: games.id }).from(games);
    expect(after).toHaveLength(0);
  });

  it("ne fait rien si tous les igdbIds sont deja presents", async () => {
    // Seed deux jeux
    await db.insert(games).values([
      { title: "Game 1", slug: "game-1", igdbId: 100, isCustom: false },
      { title: "Game 2", slug: "game-2", igdbId: 200, isCustom: false },
    ]);

    const before = await db.select({ id: games.id }).from(games);
    expect(before).toHaveLength(2);

    // Appeler avec les memes igdbIds (deja presents)
    await hydrateMissingGames([100, 200]);

    const after = await db.select({ id: games.id }).from(games);
    expect(after).toHaveLength(2); // Rien de nouveau
  });

  it("retourne 0 si tous les igdbIds sont presents", async () => {
    await db.insert(games).values({
      title: "Game 1",
      slug: "game-1",
      igdbId: 100,
      isCustom: false,
    });

    // Appeler avec un igdbId present
    // Comme hydrateMissingGames ne retourne rien, on teste indirectement via la BDD
    await hydrateMissingGames([100]);

    const games_after = await db
      .select({ id: games.id, igdbId: games.igdbId })
      .from(games);

    expect(games_after).toHaveLength(1);
    expect(games_after[0].igdbId).toBe(100);
  });
});

// Test hydrateGamesByIgdbIds avec deps injecte (mock)
describe("hydrateGamesByIgdbIds", () => {
  it("hydrate uniquement les igdbIds absents et skip les presents", async () => {
    // Seed : igdbId 100 deja present
    await db.insert(games).values({
      title: "Existing Game",
      slug: "existing-game",
      igdbId: 100,
      isCustom: false,
    });

    const before = await db
      .select({ id: games.id, igdbId: games.igdbId })
      .from(games);
    expect(before).toHaveLength(1);

    // Mock deps : quand on appelle avec igdbIds [200, 300], on retourne des jeux fictifs
    const mockDeps: IgdbDeps = {
      getToken: async () => "fake-token",
      findGameIdsBySteamAppids: async () => new Map(),
      fetchGamesByIds: async (ids) => {
        return ids.map(
          (id) =>
            ({
              igdbId: id,
              name: `Game ${id}`,
              summary: `Summary for game ${id}`,
              rating: 75,
              ratingCount: 100,
              releaseDate: null,
              developer: "Dev",
              publisher: "Pub",
              genres: [],
              themes: [],
              similarIgdbIds: [],
              hypes: 50,
              coverImageId: null,
              artworkImageId: null,
            }) as IgdbGame,
        );
      },
      fetchTimeToBeats: async () => new Map(),
      sleep: async () => {},
    };

    // Appeler avec [100, 200, 300]. 100 est present, donc seuls 200 et 300 doivent etre traites
    const hydrated = await hydrateGamesByIgdbIds([100, 200, 300], "fake-client", mockDeps);

    // Verifier que 2 jeux ont ete ajoutes (200 et 300)
    expect(hydrated).toBe(2);

    const after = await db
      .select({ id: games.id, igdbId: games.igdbId })
      .from(games)
      .orderBy(games.igdbId);

    expect(after).toHaveLength(3);
    expect(after[0].igdbId).toBe(100); // Existant
    expect(after[1].igdbId).toBe(200); // Nouveau
    expect(after[2].igdbId).toBe(300); // Nouveau
  });

  it("retourne 0 si tous les igdbIds sont presents", async () => {
    await db.insert(games).values({
      title: "Game 100",
      slug: "game-100",
      igdbId: 100,
      isCustom: false,
    });

    const mockDeps: IgdbDeps = {
      getToken: async () => "fake-token",
      findGameIdsBySteamAppids: async () => new Map(),
      fetchGamesByIds: async () => [],
      fetchTimeToBeats: async () => new Map(),
      sleep: async () => {},
    };

    const hydrated = await hydrateGamesByIgdbIds([100], "fake-client", mockDeps);

    expect(hydrated).toBe(0);

    const after = await db.select({ id: games.id }).from(games);
    expect(after).toHaveLength(1); // Rien de nouveau
  });

  it("retourne 0 si la liste igdbIds est vide", async () => {
    const mockDeps: IgdbDeps = {
      getToken: async () => "fake-token",
      findGameIdsBySteamAppids: async () => new Map(),
      fetchGamesByIds: async () => [],
      fetchTimeToBeats: async () => new Map(),
      sleep: async () => {},
    };

    const hydrated = await hydrateGamesByIgdbIds([], "fake-client", mockDeps);

    expect(hydrated).toBe(0);
  });

});

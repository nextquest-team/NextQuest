import { describe, it, expect, beforeEach } from "vitest";
import { db, games, gameUpdates } from "@nextquest/db";
import { eq } from "drizzle-orm";
import { refreshUpcomingReleases } from "../release-refresh.service.js";
import type { IgdbGame } from "../../igdb/igdb.client.js";

const TEST_IGDB_ID = 876543219;

function igdbGameFixture(overrides: Partial<IgdbGame>): IgdbGame {
  return {
    igdbId: TEST_IGDB_ID,
    name: "Refresh Test Game",
    summary: null,
    releaseDate: "2027-12-31",
    releaseDatePrecision: "year",
    rating: null,
    ratingCount: null,
    coverImageId: null,
    artworkImageId: null,
    developer: null,
    publisher: null,
    genres: [],
    themes: [],
    similarIgdbIds: [],
    hypes: 10,
    platformIds: [],
    gameType: null,
    versionParentIgdbId: null,
    ...overrides,
  };
}

function makeDeps(fetched: IgdbGame[]) {
  return {
    getToken: async () => "tok",
    fetchGamesByIds: async () => fetched,
    sleep: async () => {},
    clientId: "cid",
  };
}

async function seedUpcomingGame() {
  const [g] = await db
    .insert(games)
    .values({
      igdbId: TEST_IGDB_ID,
      title: "Refresh Test Game",
      slug: `refresh-test-game-${TEST_IGDB_ID}`,
      releaseDate: "2027-12-31",
      releaseDatePrecision: "year",
      releaseStatus: "upcoming",
      igdbHypes: 10,
    })
    .returning({ id: games.id });
  return g.id;
}

beforeEach(async () => {
  await db.delete(games).where(eq(games.igdbId, TEST_IGDB_ID)); // cascade purge game_updates
});

describe("refreshUpcomingReleases", () => {
  it("met a jour la date qui a change et trace game_updates", async () => {
    const gameId = await seedUpcomingGame();
    const deps = makeDeps([
      igdbGameFixture({ releaseDate: "2027-03-15", releaseDatePrecision: "day", hypes: 25 }),
    ]);
    const summary = await refreshUpcomingReleases(deps);
    expect(summary.updated).toBe(1);

    const [row] = await db.select().from(games).where(eq(games.id, gameId));
    expect(row.releaseDate).toBe("2027-03-15");
    expect(row.releaseDatePrecision).toBe("day");
    expect(row.igdbHypes).toBe(25);

    const updates = await db.select().from(gameUpdates).where(eq(gameUpdates.gameId, gameId));
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      fieldChanged: "release_date",
      oldValue: "2027-12-31",
      newValue: "2027-03-15",
      source: "igdb",
      processed: false,
    });
  });

  it("bascule release_status quand la date passe au passe et trace le changement", async () => {
    const gameId = await seedUpcomingGame();
    const deps = makeDeps([
      igdbGameFixture({ releaseDate: "2020-01-01", releaseDatePrecision: "day" }),
    ]);
    await refreshUpcomingReleases(deps);
    const [row] = await db.select().from(games).where(eq(games.id, gameId));
    expect(row.releaseStatus).toBe("released");
    const updates = await db.select().from(gameUpdates).where(eq(gameUpdates.gameId, gameId));
    const fields = updates.map((u) => u.fieldChanged).sort();
    expect(fields).toEqual(["release_date", "release_status"]);
  });

  it("ne touche a rien si rien n'a change (pas de game_updates, pas d'update)", async () => {
    const gameId = await seedUpcomingGame();
    const deps = makeDeps([igdbGameFixture({})]);
    const summary = await refreshUpcomingReleases(deps);
    expect(summary).toMatchObject({ checked: 1, updated: 0, failedGames: 0 });
    const updates = await db.select().from(gameUpdates).where(eq(gameUpdates.gameId, gameId));
    expect(updates).toHaveLength(0);
  });

  it("met a jour hypes seul sans tracer de game_updates", async () => {
    const gameId = await seedUpcomingGame();
    const deps = makeDeps([igdbGameFixture({ hypes: 99 })]);
    const summary = await refreshUpcomingReleases(deps);
    expect(summary.updated).toBe(1);

    const [row] = await db.select().from(games).where(eq(games.id, gameId));
    expect(row.igdbHypes).toBe(99);

    const updates = await db.select().from(gameUpdates).where(eq(gameUpdates.gameId, gameId));
    expect(updates).toHaveLength(0);
  });

  it("date retiree par IGDB (report) : reste upcoming, date nulle, trace release_date old->null", async () => {
    const gameId = await seedUpcomingGame();
    const deps = makeDeps([
      igdbGameFixture({ releaseDate: null, releaseDatePrecision: "tbd" }),
    ]);
    const summary = await refreshUpcomingReleases(deps);
    expect(summary.updated).toBe(1);

    const [row] = await db.select().from(games).where(eq(games.id, gameId));
    expect(row.releaseDate).toBeNull();
    expect(row.releaseDatePrecision).toBe("tbd");
    expect(row.releaseStatus).toBe("upcoming");

    const updates = await db.select().from(gameUpdates).where(eq(gameUpdates.gameId, gameId));
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      fieldChanged: "release_date",
      oldValue: "2027-12-31",
      newValue: null,
      source: "igdb",
    });
  });

  it("un batch IGDB en echec est compte et n'interrompt pas le run", async () => {
    await seedUpcomingGame();
    const deps = {
      ...makeDeps([]),
      fetchGamesByIds: async () => {
        throw new Error("IGDB HTTP 500");
      },
    };
    const summary = await refreshUpcomingReleases(deps);
    expect(summary.failedBatches).toBe(1);
    expect(summary.updated).toBe(0);
    expect(summary.failedGames).toBe(0);
  });
});

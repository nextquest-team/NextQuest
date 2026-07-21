import { describe, it, expect, beforeEach } from "vitest";
import { db, users, games, userGames } from "@nextquest/db";
import { inArray } from "drizzle-orm";
import { markEnrichStart } from "../../../games/igdb/enrich-progress.js";
import { getImportStatus } from "../import-status.service.js";

async function cleanup() {
  await db.delete(userGames);
  await db.delete(games);
  await db.delete(users);
}

async function createUser() {
  const [u] = await db
    .insert(users)
    .values({ email: "import-status@test.com", username: "importstatus", passwordHash: "x" })
    .returning({ id: users.id });
  return u.id;
}

async function seedGame(
  title: string,
  opts: { coverUrl?: string | null; igdbId?: number | null; lastSyncedAt?: Date | null },
) {
  const [g] = await db
    .insert(games)
    .values({
      title,
      slug: `${title.toLowerCase().replace(/\s+/g, "-")}-${Math.random().toString(36).slice(2)}`,
      coverUrl: opts.coverUrl ?? null,
      igdbId: opts.igdbId ?? null,
      lastSyncedAt: opts.lastSyncedAt ?? null,
    })
    .returning({ id: games.id });
  return g.id;
}

beforeEach(cleanup);

describe("getImportStatus", () => {
  it("sans progression Redis : idle, total/done a 0, games vide", async () => {
    const userId = await createUser();
    await seedGame("Jeu solo", { coverUrl: "http://x/cover.jpg", igdbId: 42 });

    const status = await getImportStatus(userId);

    expect(status).toEqual({ status: "idle", total: 0, done: 0, games: [] });
  });

  it("avec progression running : total du start, done = jeux du batch resync depuis startedAt, games = tous", async () => {
    const userId = await createUser();

    const enrichedGame1 = await seedGame("Enrichi 1", {
      coverUrl: "http://x/cover1.jpg",
      igdbId: 100,
      lastSyncedAt: null,
    });
    const enrichedGame2 = await seedGame("Enrichi 2", {
      coverUrl: "http://x/cover2.jpg",
      igdbId: 200,
      lastSyncedAt: null,
    });
    const pendingGame = await seedGame("Pas encore enrichi", {
      coverUrl: null,
      igdbId: null,
      lastSyncedAt: null,
    });

    await db.insert(userGames).values([
      { userId, gameId: enrichedGame1 },
      { userId, gameId: enrichedGame2 },
      { userId, gameId: pendingGame },
    ]);

    // markEnrichStart avec le batch precis suivi par ce run (comme dans
    // enrichGames) : les jeux enrichis pendant ce run recoivent un lastSyncedAt
    // posterieur a startedAt, contrairement a un jeu jamais touche.
    await markEnrichStart(userId, [enrichedGame1, enrichedGame2, pendingGame]);
    const afterStart = new Date();

    await db
      .update(games)
      .set({ lastSyncedAt: afterStart })
      .where(inArray(games.id, [enrichedGame1, enrichedGame2]));

    const status = await getImportStatus(userId);

    expect(status.status).toBe("running");
    expect(status.total).toBe(3);
    expect(status.done).toBe(2);
    expect(status.games).toHaveLength(3);

    const byId = new Map(status.games.map((g) => [g.id, g]));
    expect(byId.get(enrichedGame1)).toEqual({
      id: enrichedGame1,
      coverUrl: "http://x/cover1.jpg",
      isEnriched: true,
    });
    expect(byId.get(enrichedGame2)).toEqual({
      id: enrichedGame2,
      coverUrl: "http://x/cover2.jpg",
      isEnriched: true,
    });
    expect(byId.get(pendingGame)).toEqual({
      id: pendingGame,
      coverUrl: null,
      isEnriched: false,
    });
  });

  it("ne compte pas un jeu resynchronise avant le debut de l'enrichissement", async () => {
    const userId = await createUser();

    const staleSync = new Date(Date.now() - 60_000); // synchronise avant le start
    const oldGame = await seedGame("Vieux sync", {
      coverUrl: "http://x/old.jpg",
      igdbId: 1,
      lastSyncedAt: staleSync,
    });
    await db.insert(userGames).values({ userId, gameId: oldGame });

    await markEnrichStart(userId, [oldGame]);

    const status = await getImportStatus(userId);
    expect(status.total).toBe(1);
    expect(status.done).toBe(0);
  });

  // Fix #2 : done ne doit compter que les jeux du batch suivi par ce run. Un
  // jeu ajoute a la main pendant l'import (deja enrichi ailleurs, avec un
  // lastSyncedAt posterieur a startedAt) ne fait pas partie du batch et ne
  // doit donc pas gonfler done au-dela de total.
  it("n'inclut pas un jeu ajoute a la main pendant l'import dans le compteur done", async () => {
    const userId = await createUser();

    const batchGame = await seedGame("Jeu du batch", {
      coverUrl: "http://x/batch.jpg",
      igdbId: 10,
      lastSyncedAt: null,
    });
    await db.insert(userGames).values({ userId, gameId: batchGame });

    // Le run ne suit que batchGame : total = 1.
    await markEnrichStart(userId, [batchGame]);
    const afterStart = new Date();

    // Un jeu deja hydrate est ajoute a la main pendant que le run tourne (ex.
    // via la recherche IGDB), avec un lastSyncedAt tres recent -- mais il ne
    // fait pas partie du batch suivi.
    const manuallyAddedGame = await seedGame("Ajoute a la main", {
      coverUrl: "http://x/manual.jpg",
      igdbId: 99,
      lastSyncedAt: afterStart,
    });
    await db.insert(userGames).values({ userId, gameId: manuallyAddedGame });

    const status = await getImportStatus(userId);

    expect(status.total).toBe(1);
    expect(status.done).toBe(0);
    expect(status.done).toBeLessThanOrEqual(status.total);
  });
});

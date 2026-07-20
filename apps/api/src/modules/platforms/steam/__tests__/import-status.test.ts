import { describe, it, expect, beforeEach } from "vitest";
import { db, users, games, userGames } from "@nextquest/db";
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

  it("avec progression running : total du start, done = jeux resync depuis startedAt, games = tous", async () => {
    const userId = await createUser();

    // markEnrichStart d'abord (comme dans enrichGames) : les jeux enrichis pendant
    // ce run recoivent un lastSyncedAt posterieur a startedAt, contrairement a un
    // jeu jamais touche.
    await markEnrichStart(userId, 3);
    const afterStart = new Date();

    const enrichedGame1 = await seedGame("Enrichi 1", {
      coverUrl: "http://x/cover1.jpg",
      igdbId: 100,
      lastSyncedAt: afterStart,
    });
    const enrichedGame2 = await seedGame("Enrichi 2", {
      coverUrl: "http://x/cover2.jpg",
      igdbId: 200,
      lastSyncedAt: afterStart,
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

    await markEnrichStart(userId, 1);

    const status = await getImportStatus(userId);
    expect(status.total).toBe(1);
    expect(status.done).toBe(0);
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  db,
  users,
  games,
  userGames,
  genres,
  gameGenres,
  tags,
  gameTags,
  gameSimilar,
} from "@nextquest/db";
import { eq } from "drizzle-orm";
import { enrichGames } from "../igdb.service.js";
import type { IgdbGame } from "../igdb.client.js";

async function cleanup() {
  await db.delete(gameSimilar);
  await db.delete(gameGenres);
  await db.delete(gameTags);
  await db.delete(userGames);
  await db.delete(games);
  await db.delete(genres);
  await db.delete(tags);
  await db.delete(users);
}

async function createUser() {
  const [u] = await db
    .insert(users)
    .values({ email: "igdb@test.com", username: "igdbtester", passwordHash: "x" })
    .returning({ id: users.id });
  return u.id;
}

async function seedGame(steamAppid: number, title: string) {
  const [g] = await db
    .insert(games)
    .values({ steamAppid, title, slug: `${title.toLowerCase()}-${steamAppid}` })
    .returning({ id: games.id });
  return g.id;
}

const sampleIgdbGame = (over: Partial<IgdbGame> = {}): IgdbGame => ({
  igdbId: 1020,
  name: "GTA V",
  summary: "Open world",
  releaseDate: "2013-09-17",
  rating: 92.3,
  ratingCount: 1500,
  coverImageId: "cover123",
  artworkImageId: "art456",
  developer: "Rockstar North",
  publisher: "Rockstar Games",
  genres: [{ igdbId: 5, name: "Shooter", slug: "shooter" }],
  themes: [{ igdbId: 1, name: "Action", slug: "action" }],
  similarIgdbIds: [11, 22],
  ...over,
});

// Client mocké : on contrôle le mapping appid->igdbId et le fetch metadonnees.
function makeClient(map: Record<number, number>, gamesById: Record<number, IgdbGame>) {
  return {
    getToken: vi.fn(async () => "TOKEN"),
    findGameIdsBySteamAppids: vi.fn(async (appids: number[]) => {
      const m = new Map<number, number>();
      for (const a of appids) if (map[a] != null) m.set(a, map[a]);
      return m;
    }),
    fetchGamesByIds: vi.fn(async (ids: number[]) => ids.map((id) => gamesById[id]).filter(Boolean)),
    sleep: vi.fn(async () => {}),
  };
}

beforeEach(cleanup);

describe("enrichGames (scopé user)", () => {
  it("mappe, fetch et upsert les metadonnees + genres + themes + similar", async () => {
    const userId = await createUser();
    const gameId = await seedGame(3498, "GTA V");
    await db.insert(userGames).values({ userId, gameId });

    const client = makeClient({ 3498: 1020 }, { 1020: sampleIgdbGame() });

    const summary = await enrichGames({ userId }, "CID", client);

    expect(summary.enriched).toBe(1);

    const [g] = await db.select().from(games).where(eq(games.id, gameId));
    expect(g.igdbId).toBe(1020);
    expect(g.description).toBe("Open world");
    expect(g.releaseDate).toBe("2013-09-17");
    expect(g.igdbRating).toBeCloseTo(92.3, 1);
    expect(g.igdbRatingCount).toBe(1500);
    expect(g.developer).toBe("Rockstar North");
    expect(g.coverUrl).toContain("cover123");
    expect(g.lastSyncedAt).not.toBeNull();

    const gg = await db.select().from(gameGenres).where(eq(gameGenres.gameId, gameId));
    expect(gg).toHaveLength(1);
    const gt = await db.select().from(gameTags).where(eq(gameTags.gameId, gameId));
    expect(gt).toHaveLength(1);
    const sim = await db.select().from(gameSimilar).where(eq(gameSimilar.gameId, gameId));
    expect(sim.map((s) => s.similarIgdbId).sort()).toEqual([11, 22]);
  });

  it("est idempotent : relancer ne duplique pas genres/themes/similar", async () => {
    const userId = await createUser();
    const gameId = await seedGame(3498, "GTA V");
    await db.insert(userGames).values({ userId, gameId });
    const client = makeClient({ 3498: 1020 }, { 1020: sampleIgdbGame() });

    await enrichGames({ userId }, "CID", client);
    await enrichGames({ userId }, "CID", client);

    const sim = await db.select().from(gameSimilar).where(eq(gameSimilar.gameId, gameId));
    expect(sim).toHaveLength(2);
    const gg = await db.select().from(gameGenres).where(eq(gameGenres.gameId, gameId));
    expect(gg).toHaveLength(1);
  });

  it("jeu introuvable sur IGDB : marque last_synced_at, igdb_id reste null", async () => {
    const userId = await createUser();
    const gameId = await seedGame(999999, "Inconnu");
    await db.insert(userGames).values({ userId, gameId });
    const client = makeClient({}, {}); // aucun mapping

    const summary = await enrichGames({ userId }, "CID", client);

    expect(summary.notFound).toBe(1);
    const [g] = await db.select().from(games).where(eq(games.id, gameId));
    expect(g.igdbId).toBeNull();
    expect(g.lastSyncedAt).not.toBeNull();
  });

  it("ne re-sélectionne pas un jeu déjà enrichi (igdb_id non null, frais)", async () => {
    const userId = await createUser();
    const gameId = await seedGame(3498, "GTA V");
    await db.insert(userGames).values({ userId, gameId });
    const client = makeClient({ 3498: 1020 }, { 1020: sampleIgdbGame() });

    await enrichGames({ userId }, "CID", client);
    client.fetchGamesByIds.mockClear();
    const summary = await enrichGames({ userId }, "CID", client);

    expect(summary.scanned).toBe(0);
    expect(client.fetchGamesByIds).not.toHaveBeenCalled();
  });
});

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
  hypes: 850,
  platformIds: [],
  gameType: null,
  versionParentIgdbId: null,
  ...over,
});

// Client mocké : on contrôle le mapping appid->igdbId et le fetch metadonnees.
function makeClient(
  map: Record<number, number>,
  gamesById: Record<number, IgdbGame>,
  timeToBeatsById: Record<number, { normallyMinutes: number; count: number }> = {},
) {
  return {
    getToken: vi.fn(async () => "TOKEN"),
    findGameIdsBySteamAppids: vi.fn(async (appids: number[]) => {
      const m = new Map<number, number>();
      for (const a of appids) if (map[a] != null) m.set(a, map[a]);
      return m;
    }),
    fetchGamesByIds: vi.fn(async (ids: number[]) => ids.map((id) => gamesById[id]).filter(Boolean)),
    fetchTimeToBeats: vi.fn(async (ids: number[]) => {
      const m = new Map<number, { normallyMinutes: number; count: number }>();
      for (const id of ids) if (timeToBeatsById[id] != null) m.set(id, timeToBeatsById[id]);
      return m;
    }),
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

  it("sélectionne un jeu avec igdb_id mais jamais synchronisé (last_synced_at null)", async () => {
    const userId = await createUser();
    // igdb_id deja pose mais last_synced_at null : peut arriver via un flux qui
    // renseigne l'igdb_id sans enrichir. En SQL `null < staleCutoff` vaut NULL,
    // donc sans le isNull(last_synced_at) ce jeu ne serait jamais candidat.
    const [g] = await db
      .insert(games)
      .values({ steamAppid: 3498, title: "GTA V", slug: "gta-v-3498", igdbId: 1020 })
      .returning({ id: games.id });
    await db.insert(userGames).values({ userId, gameId: g.id });
    const client = makeClient({}, { 1020: sampleIgdbGame() });

    const summary = await enrichGames({ userId }, "CID", client);

    expect(summary.scanned).toBe(1);
    expect(summary.enriched).toBe(1);
    const [after] = await db.select().from(games).where(eq(games.id, g.id));
    expect(after.lastSyncedAt).not.toBeNull();
  });

  it("stocke avgPlaytime (time_to_beats converti) et igdbHypes", async () => {
    const userId = await createUser();
    const gameId = await seedGame(3498, "GTA V");
    await db.insert(userGames).values({ userId, gameId });

    const client = makeClient(
      { 3498: 1020 },
      { 1020: sampleIgdbGame({ hypes: 850 }) },
      { 1020: { normallyMinutes: 120, count: 42 } },
    );

    const summary = await enrichGames({ userId }, "CID", client);

    expect(summary.enriched).toBe(1);
    const [g] = await db.select().from(games).where(eq(games.id, gameId));
    expect(g.avgPlaytime).toBe(120);
    expect(g.igdbHypes).toBe(850);
  });

  it("fallback : pas d'entree time_to_beats -> avgPlaytime reste null", async () => {
    const userId = await createUser();
    const gameId = await seedGame(3498, "GTA V");
    await db.insert(userGames).values({ userId, gameId });

    const client = makeClient(
      { 3498: 1020 },
      { 1020: sampleIgdbGame({ hypes: 850 }) },
      {}, // aucune entree time_to_beats
    );

    const summary = await enrichGames({ userId }, "CID", client);

    expect(summary.enriched).toBe(1);
    const [g] = await db.select().from(games).where(eq(games.id, gameId));
    expect(g.avgPlaytime).toBeNull();
    expect(g.igdbHypes).toBe(850);
  });

  it("derive releaseStatus='upcoming' si release date dans le futur", async () => {
    const userId = await createUser();
    const gameId = await seedGame(9999, "Upcoming Game");
    await db.insert(userGames).values({ userId, gameId });

    // Date dans le futur : 5 ans a partir de maintenant.
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 5);
    const futureDateStr = futureDate.toISOString().slice(0, 10);

    const futureGame = sampleIgdbGame({ igdbId: 5000, releaseDate: futureDateStr });
    const client = makeClient(
      { 9999: 5000 },
      { 5000: futureGame },
    );

    const summary = await enrichGames({ userId }, "CID", client);

    expect(summary.enriched).toBe(1);
    const [g] = await db.select().from(games).where(eq(games.id, gameId));
    expect(g.releaseStatus).toBe("upcoming");
    expect(g.releaseDate).toBe(futureDateStr);
  });

  it("derive releaseStatus='released' si release date dans le passe", async () => {
    const userId = await createUser();
    const gameId = await seedGame(8888, "Past Game");
    await db.insert(userGames).values({ userId, gameId });

    const pastGame = sampleIgdbGame({ igdbId: 4000, releaseDate: "2020-01-15" });
    const client = makeClient(
      { 8888: 4000 },
      { 4000: pastGame },
    );

    const summary = await enrichGames({ userId }, "CID", client);

    expect(summary.enriched).toBe(1);
    const [g] = await db.select().from(games).where(eq(games.id, gameId));
    expect(g.releaseStatus).toBe("released");
    expect(g.releaseDate).toBe("2020-01-15");
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { db, games, genres, gameGenres, users, userFollowedGames } from "@nextquest/db";
import { eq } from "drizzle-orm";
import { followGame, unfollowGame, listFollowedGames } from "../follow.service.js";

const TEST_EMAIL = "follow-service@test.com";
const TEST_IGDB_ID = 987654321;

// Simule l'hydratation : insere le jeu en BDD comme le ferait hydrateGamesByIgdbIds.
async function fakeHydrate(): Promise<number> {
  const existing = await db.select({ id: games.id }).from(games).where(eq(games.igdbId, TEST_IGDB_ID));
  if (existing.length > 0) return 0;
  const [g] = await db
    .insert(games)
    .values({
      igdbId: TEST_IGDB_ID,
      title: "Follow Test Game",
      slug: `follow-test-game-${TEST_IGDB_ID}`,
      releaseDate: "2027-12-31",
      releaseDatePrecision: "year",
      releaseStatus: "upcoming",
      igdbHypes: 42,
    })
    .returning({ id: games.id });
  const [gen] = await db
    .insert(genres)
    .values({ name: "Follow Genre", slug: "follow-test-genre", igdbId: 424242 })
    .onConflictDoUpdate({ target: genres.slug, set: { igdbId: 424242 } })
    .returning({ id: genres.id });
  await db.insert(gameGenres).values({ gameId: g.id, genreId: gen.id }).onConflictDoNothing();
  return 1;
}
const deps = { hydrate: fakeHydrate };

async function cleanup() {
  await db.delete(games).where(eq(games.igdbId, TEST_IGDB_ID)); // cascade purge follows + gameGenres
  await db.delete(genres).where(eq(genres.slug, "follow-test-genre"));
  await db.delete(users).where(eq(users.email, TEST_EMAIL));
}

async function seedUser() {
  const [u] = await db
    .insert(users)
    .values({ email: TEST_EMAIL, username: "followsvc", passwordHash: "x" })
    .returning({ id: users.id });
  return u.id;
}

beforeEach(cleanup);

describe("follow.service", () => {
  it("followGame hydrate, insere le suivi et renvoie le DTO complet", async () => {
    const userId = await seedUser();
    const dto = await followGame(userId, TEST_IGDB_ID, deps);
    expect(dto).toMatchObject({
      igdbId: TEST_IGDB_ID,
      title: "Follow Test Game",
      releaseDate: "2027-12-31",
      releaseDatePrecision: "year",
      hypes: 42,
    });
    expect(dto!.genres).toEqual([{ igdbId: 424242, name: "Follow Genre", slug: "follow-test-genre" }]);
  });

  it("followGame est idempotent (double follow = un seul suivi)", async () => {
    const userId = await seedUser();
    await followGame(userId, TEST_IGDB_ID, deps);
    await followGame(userId, TEST_IGDB_ID, deps);
    const rows = await db.select().from(userFollowedGames).where(eq(userFollowedGames.userId, userId));
    expect(rows).toHaveLength(1);
  });

  it("followGame renvoie null si le jeu reste introuvable apres hydratation", async () => {
    const userId = await seedUser();
    const dto = await followGame(userId, TEST_IGDB_ID, { hydrate: async () => 0 });
    expect(dto).toBeNull();
  });

  it("listFollowedGames renvoie les jeux suivis, unfollowGame les retire (idempotent)", async () => {
    const userId = await seedUser();
    await followGame(userId, TEST_IGDB_ID, deps);
    expect(await listFollowedGames(userId)).toHaveLength(1);
    await unfollowGame(userId, TEST_IGDB_ID);
    await unfollowGame(userId, TEST_IGDB_ID); // deuxieme appel : no-op silencieux
    expect(await listFollowedGames(userId)).toHaveLength(0);
  });

  it("RGPD : supprimer le user purge ses suivis (cascade BDD, pas de code applicatif)", async () => {
    const userId = await seedUser();
    await followGame(userId, TEST_IGDB_ID, deps);
    await db.delete(users).where(eq(users.id, userId));
    const rows = await db.select().from(userFollowedGames).where(eq(userFollowedGames.userId, userId));
    expect(rows).toHaveLength(0);
  });
});

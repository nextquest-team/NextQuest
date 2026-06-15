import { describe, it, expect, beforeEach } from "vitest";
import {
  db,
  users,
  games,
  userGames,
  userGameStatusHistory,
  genres,
  tags,
  gameGenres,
  gameTags,
  gameSimilar,
} from "@nextquest/db";
import { eq } from "drizzle-orm";
import {
  updateGameStatus,
  listCollection,
} from "../collection.service.js";
import type { GameStatus } from "../collection.schemas.js";

async function cleanup() {
  // La FK user_game_status_history / user_game_tags -> user_games est ON DELETE
  // CASCADE : supprimer user_games purge aussi l'historique et les tags du jeu.
  await db.delete(userGames);
  await db.delete(gameTags);
  await db.delete(gameGenres);
  await db.delete(gameSimilar);
  await db.delete(games);
  await db.delete(tags);
  await db.delete(genres);
  await db.delete(users);
}

// Seed riche : un user + 2 jeux dans sa collection, genres/tags sur le 1er,
// le 2e masque (isHidden) pour tester le filtre par defaut.
async function seedCollection() {
  const [u] = await db
    .insert(users)
    .values({ email: "list@test.com", username: "listu", passwordHash: "x" })
    .returning({ id: users.id });
  const [g1] = await db
    .insert(games)
    .values({ title: "Hollow Knight", slug: "hk-1", igdbId: 1 })
    .returning({ id: games.id });
  const [g2] = await db
    .insert(games)
    .values({ title: "Celeste", slug: "celeste-1" })
    .returning({ id: games.id });
  const [genre] = await db
    .insert(genres)
    .values({ name: "Platform", slug: "platform" })
    .returning({ id: genres.id });
  const [tag] = await db
    .insert(tags)
    .values({ name: "Action", slug: "action", category: "theme", igdbId: 1 })
    .returning({ id: tags.id });
  await db.insert(gameGenres).values({ gameId: g1.id, genreId: genre.id });
  await db.insert(gameTags).values({ gameId: g1.id, tagId: tag.id });
  const [ug1] = await db
    .insert(userGames)
    .values({ userId: u.id, gameId: g1.id, status: "playing" })
    .returning({ id: userGames.id });
  const [ug2] = await db
    .insert(userGames)
    .values({ userId: u.id, gameId: g2.id, status: "backlog", isHidden: true })
    .returning({ id: userGames.id });
  return { userId: u.id, gameId1: g1.id, gameId2: g2.id, ug1: ug1.id, ug2: ug2.id };
}

async function seedUserGame(status: GameStatus = "backlog") {
  const [u] = await db
    .insert(users)
    .values({
      email: "collection-svc@test.com",
      username: "collsvc",
      passwordHash: "x",
    })
    .returning({ id: users.id });
  const [g] = await db
    .insert(games)
    .values({ title: "Test Game", slug: "test-game-svc" })
    .returning({ id: games.id });
  const [ug] = await db
    .insert(userGames)
    .values({ userId: u.id, gameId: g.id, status })
    .returning({ id: userGames.id });
  return { userId: u.id, userGameId: ug.id };
}

beforeEach(cleanup);

describe("updateGameStatus", () => {
  it("change le statut et historise le changement", async () => {
    const { userId, userGameId } = await seedUserGame("backlog");

    const dto = await updateGameStatus(userId, userGameId, "completed");
    expect(dto?.status).toBe("completed");

    const history = await db
      .select()
      .from(userGameStatusHistory)
      .where(eq(userGameStatusHistory.userGameId, userGameId));
    expect(history).toHaveLength(1);
    expect(history[0].oldStatus).toBe("backlog");
    expect(history[0].newStatus).toBe("completed");
  });

  it("pose started_at a la 1re transition vers playing et ne le reecrit pas ensuite", async () => {
    const { userId, userGameId } = await seedUserGame("backlog");

    const first = await updateGameStatus(userId, userGameId, "playing");
    expect(first?.startedAt).not.toBeNull();
    const startedAt = first?.startedAt;

    // playing -> completed -> playing : started_at ne doit pas bouger
    await updateGameStatus(userId, userGameId, "completed");
    const back = await updateGameStatus(userId, userGameId, "playing");
    expect(back?.startedAt).toBe(startedAt);
  });

  it("pose completed_at a la 1re transition vers completed", async () => {
    const { userId, userGameId } = await seedUserGame("playing");
    const dto = await updateGameStatus(userId, userGameId, "completed");
    expect(dto?.completedAt).not.toBeNull();
  });

  it("no-op si le statut est inchange : aucune ligne d'historique", async () => {
    const { userId, userGameId } = await seedUserGame("playing");

    const dto = await updateGameStatus(userId, userGameId, "playing");
    expect(dto?.status).toBe("playing");

    const history = await db
      .select()
      .from(userGameStatusHistory)
      .where(eq(userGameStatusHistory.userGameId, userGameId));
    expect(history).toHaveLength(0);
  });

  it("renvoie null si le user_game n'appartient pas au user", async () => {
    const { userGameId } = await seedUserGame("backlog");
    const dto = await updateGameStatus(
      "00000000-0000-0000-0000-000000000000",
      userGameId,
      "playing",
    );
    expect(dto).toBeNull();
  });
});

describe("listCollection", () => {
  it("renvoie les jeux du user avec genres/tags inline et total", async () => {
    const { userId } = await seedCollection();
    const { items, total } = await listCollection({
      userId,
      limit: 20,
      offset: 0,
      includeHidden: false,
    });
    // ug2 est isHidden -> exclu par defaut
    expect(total).toBe(1);
    expect(items[0].game.title).toBe("Hollow Knight");
    expect(items[0].genres.map((x) => x.name)).toContain("Platform");
    expect(items[0].tags.map((x) => x.name)).toContain("Action");
    expect(items[0].game.isEnriched).toBe(true);
  });
  it("inclut les jeux masques si includeHidden=true", async () => {
    const { userId } = await seedCollection();
    const { total } = await listCollection({
      userId,
      limit: 20,
      offset: 0,
      includeHidden: true,
    });
    expect(total).toBe(2);
  });
  it("filtre par statut", async () => {
    const { userId } = await seedCollection();
    const { items, total } = await listCollection({
      userId,
      status: "playing",
      limit: 20,
      offset: 0,
      includeHidden: true,
    });
    expect(total).toBe(1);
    expect(items[0].status).toBe("playing");
  });
  it("pagine (limit/offset)", async () => {
    const { userId } = await seedCollection();
    const page = await listCollection({
      userId,
      limit: 1,
      offset: 0,
      includeHidden: true,
    });
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(2);
  });
  it("ne renvoie jamais la collection d'un autre user", async () => {
    await seedCollection();
    const res = await listCollection({
      userId: "00000000-0000-0000-0000-000000000000",
      limit: 20,
      offset: 0,
      includeHidden: true,
    });
    expect(res.total).toBe(0);
    expect(res.items).toEqual([]);
  });
});

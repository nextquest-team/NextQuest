import { describe, it, expect, beforeEach } from "vitest";
import {
  db,
  users,
  games,
  userGames,
  userGameStatusHistory,
} from "@nextquest/db";
import { eq } from "drizzle-orm";
import { updateGameStatus } from "../collection.service.js";
import type { GameStatus } from "../collection.schemas.js";

async function cleanup() {
  // La FK user_game_status_history -> user_games est ON DELETE CASCADE :
  // supprimer user_games purge aussi l'historique.
  await db.delete(userGames);
  await db.delete(games);
  await db.delete(users);
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

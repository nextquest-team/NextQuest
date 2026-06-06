import { describe, it, expect, beforeEach } from "vitest";
import { db, users, connectedServices, userGames, games } from "@nextquest/db";
import { eq } from "drizzle-orm";
import {
  linkSteamAccount,
  unlinkSteamAccount,
  getSteamConnection,
  importSteamLibrary,
} from "../steam.service.js";

async function cleanup() {
  await db.delete(userGames);
  await db.delete(games);
  await db.delete(connectedServices);
  await db.delete(users);
}

async function createUser() {
  const [u] = await db
    .insert(users)
    .values({
      email: "steam-test@test.com",
      username: "steamtester",
      passwordHash: "x",
    })
    .returning({ id: users.id });
  return u.id;
}

beforeEach(cleanup);

describe("linkSteamAccount / getSteamConnection", () => {
  it("lie un compte Steam et le retrouve", async () => {
    const userId = await createUser();

    await linkSteamAccount(userId, "76561198000000000", "Gaben");

    expect(await getSteamConnection(userId)).toEqual({
      steamId: "76561198000000000",
      personaName: "Gaben",
    });
  });

  it("est idempotent : relier met a jour sans creer de doublon", async () => {
    const userId = await createUser();

    await linkSteamAccount(userId, "76561198000000000", "Gaben");
    await linkSteamAccount(userId, "76561198000000001", "NewName");

    const rows = await db
      .select()
      .from(connectedServices)
      .where(eq(connectedServices.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0].externalUserId).toBe("76561198000000001");
    expect(rows[0].externalUsername).toBe("NewName");
  });

  it("renvoie null quand aucun compte Steam n'est lie", async () => {
    const userId = await createUser();
    expect(await getSteamConnection(userId)).toBeNull();
  });
});

describe("unlinkSteamAccount", () => {
  it("supprime le lien et renvoie true", async () => {
    const userId = await createUser();
    await linkSteamAccount(userId, "76561198000000000", "Gaben");

    expect(await unlinkSteamAccount(userId)).toBe(true);
    expect(await getSteamConnection(userId)).toBeNull();
  });

  it("renvoie false si rien n'etait lie", async () => {
    const userId = await createUser();
    expect(await unlinkSteamAccount(userId)).toBe(false);
  });
});

describe("importSteamLibrary", () => {
  it("importe les jeux dans games + user_games avec le temps de jeu", async () => {
    const userId = await createUser();

    const count = await importSteamLibrary(userId, [
      { appid: 570, name: "Dota 2", playtimeMinutes: 1200 },
      { appid: 730, name: "Counter-Strike 2", playtimeMinutes: 0 },
    ]);

    expect(count).toBe(2);

    const ug = await db
      .select()
      .from(userGames)
      .where(eq(userGames.userId, userId));
    expect(ug).toHaveLength(2);

    const dota = await db
      .select()
      .from(games)
      .where(eq(games.steamAppid, 570));
    expect(dota).toHaveLength(1);
    expect(dota[0].title).toBe("Dota 2");

    const dotaUg = ug.find((r) => r.gameId === dota[0].id);
    expect(dotaUg?.playtimeMinutes).toBe(1200);
  });

  it("est idempotent : reimporter met a jour les heures sans dupliquer", async () => {
    const userId = await createUser();

    await importSteamLibrary(userId, [
      { appid: 570, name: "Dota 2", playtimeMinutes: 1200 },
    ]);
    await importSteamLibrary(userId, [
      { appid: 570, name: "Dota 2", playtimeMinutes: 1500 },
    ]);

    const g = await db.select().from(games).where(eq(games.steamAppid, 570));
    expect(g).toHaveLength(1);

    const ug = await db
      .select()
      .from(userGames)
      .where(eq(userGames.userId, userId));
    expect(ug).toHaveLength(1);
    expect(ug[0].playtimeMinutes).toBe(1500);
  });

  it("ne fait rien et renvoie 0 pour une bibliotheque vide", async () => {
    const userId = await createUser();
    expect(await importSteamLibrary(userId, [])).toBe(0);
  });
});

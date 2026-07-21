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
  platforms,
} from "@nextquest/db";
import { eq, and } from "drizzle-orm";
import {
  updateGameStatus,
  listCollection,
  getCollectionItem,
  updateCollectionItem,
  deleteCollectionItem,
  addGameToCollection,
  ignoreUserGame,
  restoreUserGame,
} from "../collection.service.js";
import type { GameStatus } from "../collection.schemas.js";

async function cleanup() {
  // La FK user_game_status_history / user_game_tags -> user_games est ON DELETE
  // CASCADE : supprimer user_games purge aussi l'historique et les tags du jeu.
  await db.delete(userGames);
  // Plateforme de test creee a la volee (cf. describe "ignoreUserGame"), nettoyee
  // par code plutot que de vider toute la table, qui porte les donnees de
  // reference partagees (pc, steam...) utilisees ailleurs.
  await db.delete(platforms).where(eq(platforms.code, "switch-excl-test"));
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
  it("filtre par titre et calcule le total sans planter (count joint games)", async () => {
    // Garde-fou de regression : quand search est present, le count() doit
    // joindre games, sinon games.title n'est pas dans le scope -> erreur SQL/500.
    const { userId } = await seedCollection();
    const { items, total } = await listCollection({
      userId,
      search: "hollow",
      limit: 20,
      offset: 0,
      includeHidden: true,
    });
    expect(total).toBe(1);
    expect(items).toHaveLength(1);
    expect(items[0].game.title).toBe("Hollow Knight");
  });
  it("recherche insensible a la casse (ilike)", async () => {
    const { userId } = await seedCollection();
    const lower = await listCollection({
      userId,
      search: "hollow knight",
      limit: 20,
      offset: 0,
      includeHidden: true,
    });
    const upper = await listCollection({
      userId,
      search: "HOLLOW KNIGHT",
      limit: 20,
      offset: 0,
      includeHidden: true,
    });
    expect(lower.total).toBe(1);
    expect(upper.total).toBe(1);
  });
  it("combine recherche et statut (ET logique)", async () => {
    const { userId } = await seedCollection();
    // Celeste est en backlog (et masque) -> match avec includeHidden.
    const match = await listCollection({
      userId,
      search: "celeste",
      status: "backlog",
      limit: 20,
      offset: 0,
      includeHidden: true,
    });
    expect(match.total).toBe(1);
    expect(match.items[0].game.title).toBe("Celeste");
    // Meme titre mais mauvais statut -> aucun resultat.
    const noMatch = await listCollection({
      userId,
      search: "celeste",
      status: "playing",
      limit: 20,
      offset: 0,
      includeHidden: true,
    });
    expect(noMatch.total).toBe(0);
  });
  it("renvoie 0 resultat si aucun titre ne correspond", async () => {
    const { userId } = await seedCollection();
    const res = await listCollection({
      userId,
      search: "zelda",
      limit: 20,
      offset: 0,
      includeHidden: true,
    });
    expect(res.total).toBe(0);
    expect(res.items).toEqual([]);
  });
  it("view=ignored ne renvoie que les jeux ignores, view=library (defaut) les exclut", async () => {
    const { userId, ug1 } = await seedCollection();
    await db
      .update(userGames)
      .set({ excludedAt: new Date() })
      .where(eq(userGames.id, ug1));

    const library = await listCollection({
      userId,
      limit: 20,
      offset: 0,
      includeHidden: true,
    });
    expect(library.items.find((i) => i.userGameId === ug1)).toBeUndefined();

    const ignored = await listCollection({
      userId,
      limit: 20,
      offset: 0,
      includeHidden: true,
      view: "ignored",
    });
    expect(ignored.total).toBe(1);
    expect(ignored.items[0].userGameId).toBe(ug1);
  });
});

describe("getCollectionItem", () => {
  it("renvoie le detail avec description, genres, tags et jeux similaires", async () => {
    const { userId, gameId1, ug1 } = await seedCollection();
    // un jeu similaire qu'on possede dans le catalogue (igdbId=42), relie a g1.
    await db
      .insert(games)
      .values({ title: "Ori", slug: "ori-1", igdbId: 42 });
    await db
      .update(games)
      .set({ description: "metroidvania" })
      .where(eq(games.id, gameId1));
    await db.insert(gameSimilar).values({ gameId: gameId1, similarIgdbId: 42 });

    const dto = await getCollectionItem(userId, ug1);
    expect(dto?.description).toBe("metroidvania");
    expect(dto?.similarGames.map((s) => s.title)).toContain("Ori");
    expect(dto?.genres.map((x) => x.name)).toContain("Platform");
  });
  it("renvoie null si le jeu n'appartient pas au user", async () => {
    const { ug1 } = await seedCollection();
    const dto = await getCollectionItem(
      "00000000-0000-0000-0000-000000000000",
      ug1,
    );
    expect(dto).toBeNull();
  });
});

describe("updateCollectionItem", () => {
  it("met a jour note/avis/playtime/isHidden et renvoie l'item", async () => {
    const { userId, ug1 } = await seedCollection();
    const dto = await updateCollectionItem(userId, ug1, {
      rating: 9,
      review: "genial",
      isHidden: true,
    });
    expect(dto?.rating).toBe(9);
    expect(dto?.review).toBe("genial");
    expect(dto?.isHidden).toBe(true);
  });
  it("efface la note avec null", async () => {
    const { userId, ug1 } = await seedCollection();
    await updateCollectionItem(userId, ug1, { rating: 5 });
    const dto = await updateCollectionItem(userId, ug1, { rating: null });
    expect(dto?.rating).toBeNull();
  });
  it("renvoie null si non possede", async () => {
    const { ug1 } = await seedCollection();
    const dto = await updateCollectionItem(
      "00000000-0000-0000-0000-000000000000",
      ug1,
      { rating: 5 },
    );
    expect(dto).toBeNull();
  });
});

describe("deleteCollectionItem", () => {
  it("supprime la ligne et purge l'historique en cascade", async () => {
    const { userId, ug1 } = await seedCollection();
    await updateGameStatus(userId, ug1, "completed"); // cree une ligne d'historique
    const ok = await deleteCollectionItem(userId, ug1);
    expect(ok).toBe(true);
    const remaining = await db
      .select()
      .from(userGames)
      .where(eq(userGames.id, ug1));
    expect(remaining).toHaveLength(0);
    const hist = await db
      .select()
      .from(userGameStatusHistory)
      .where(eq(userGameStatusHistory.userGameId, ug1));
    expect(hist).toHaveLength(0); // cascade
  });
  it("renvoie false si non possede (et ne supprime rien)", async () => {
    const { ug1 } = await seedCollection();
    const ok = await deleteCollectionItem(
      "00000000-0000-0000-0000-000000000000",
      ug1,
    );
    expect(ok).toBe(false);
    const remaining = await db
      .select()
      .from(userGames)
      .where(eq(userGames.id, ug1));
    expect(remaining).toHaveLength(1);
  });
});

describe("addGameToCollection", () => {
  it("ajoute un jeu existant et renvoie l'item (status backlog)", async () => {
    const { userId } = await seedCollection();
    const [g3] = await db
      .insert(games)
      .values({ title: "Dead Cells", slug: "dc-1" })
      .returning({ id: games.id });
    const res = await addGameToCollection(userId, { gameId: g3.id });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.item.status).toBe("backlog");
  });
  it("renvoie game_not_found si le jeu n'existe pas", async () => {
    const { userId } = await seedCollection();
    const res = await addGameToCollection(userId, {
      gameId: "00000000-0000-0000-0000-000000000000",
    });
    expect(res).toEqual({ ok: false, reason: "game_not_found" });
  });
  it("renvoie conflict si deja present (meme platformId null)", async () => {
    const { userId, gameId2 } = await seedCollection(); // gameId2 deja ajoute, platformId null
    const res = await addGameToCollection(userId, { gameId: gameId2 });
    expect(res).toEqual({ ok: false, reason: "conflict" });
  });
  it("reactive un jeu ignore lors de l'ajout (au lieu de conflict)", async () => {
    const { userId } = await seedCollection();
    const [g3] = await db
      .insert(games)
      .values({ title: "Dead Cells", slug: "dc-2" })
      .returning({ id: games.id });
    const [ug3] = await db
      .insert(userGames)
      .values({ userId, gameId: g3.id, status: "completed" })
      .returning({ id: userGames.id });
    await ignoreUserGame(userId, ug3.id);

    const res = await addGameToCollection(userId, { gameId: g3.id });
    expect(res.ok).toBe(true);
    if (res.ok) {
      // Reactivation de la ligne existante : statut preserve, pas de doublon.
      expect(res.item.userGameId).toBe(ug3.id);
      expect(res.item.status).toBe("completed");
    }

    const rows = await db
      .select()
      .from(userGames)
      .where(and(eq(userGames.userId, userId), eq(userGames.gameId, g3.id)));
    expect(rows).toHaveLength(1);
    expect(rows[0].excludedAt).toBeNull();
  });
});

describe("ignoreUserGame / restoreUserGame", () => {
  it("ignore un jeu : disparait de listCollection(view=library) mais garde son statut", async () => {
    const { userId, ug1 } = await seedCollection(); // ug1 status "playing"
    await updateGameStatus(userId, ug1, "completed");

    expect(await ignoreUserGame(userId, ug1)).toBe(true);

    const library = await listCollection({
      userId,
      limit: 20,
      offset: 0,
      includeHidden: true,
      view: "library",
    });
    expect(library.items.find((i) => i.userGameId === ug1)).toBeUndefined();

    const ignored = await listCollection({
      userId,
      limit: 20,
      offset: 0,
      includeHidden: true,
      view: "ignored",
    });
    const item = ignored.items.find((i) => i.userGameId === ug1);
    expect(item?.status).toBe("completed");
  });

  it("restore un jeu ignore : statut TOUJOURS intact (cas cle)", async () => {
    const { userId, ug1 } = await seedCollection();
    await updateGameStatus(userId, ug1, "completed");

    expect(await ignoreUserGame(userId, ug1)).toBe(true);
    expect(await restoreUserGame(userId, ug1)).toBe(true);

    const [row] = await db
      .select()
      .from(userGames)
      .where(eq(userGames.id, ug1));
    expect(row.status).toBe("completed");
    expect(row.excludedAt).toBeNull();

    const library = await listCollection({
      userId,
      limit: 20,
      offset: 0,
      includeHidden: true,
      view: "library",
    });
    expect(library.items.find((i) => i.userGameId === ug1)?.status).toBe(
      "completed",
    );
  });

  it("renvoie false si le user_game n'appartient pas au user", async () => {
    const { ug1 } = await seedCollection();
    expect(
      await ignoreUserGame("00000000-0000-0000-0000-000000000000", ug1),
    ).toBe(false);
    expect(
      await restoreUserGame("00000000-0000-0000-0000-000000000000", ug1),
    ).toBe(false);
  });

  it("ne plante pas si le meme jeu (sur 2 plateformes) a 2 lignes ignorees independamment", async () => {
    // Un meme jeu peut avoir 2 lignes user_games (une par plateforme, ex: PC + Switch).
    // Ignorer/restaurer chaque ligne est independant (le flag vit sur user_games,
    // plus de contrainte d'unicite globale par jeu).
    const { userId, gameId1, ug1 } = await seedCollection();
    const [platform] = await db
      .insert(platforms)
      .values({ name: "Switch", code: "switch-excl-test" })
      .returning({ id: platforms.id });
    const [ug1bis] = await db
      .insert(userGames)
      .values({
        userId,
        gameId: gameId1,
        platformId: platform.id,
        status: "backlog",
      })
      .returning({ id: userGames.id });

    expect(await ignoreUserGame(userId, ug1)).toBe(true);
    expect(await ignoreUserGame(userId, ug1bis.id)).toBe(true);

    const rows = await db
      .select()
      .from(userGames)
      .where(eq(userGames.gameId, gameId1));
    expect(rows.every((r) => r.excludedAt !== null)).toBe(true);
  });
});

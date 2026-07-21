import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";
import { validatorCompiler, serializerCompiler } from "fastify-type-provider-zod";
import { db, users, games, userGames } from "@nextquest/db";
import { eq } from "drizzle-orm";
import { registerJwt } from "../../../plugins/jwt.js";
import { registerErrorHandler } from "../../../lib/error-handler.js";
import { registerSwagger } from "../../../plugins/swagger.js";
import { collectionRoutes } from "../collection.routes.js";
import {
  addIgdbGameToCollection,
  ignoreUserGame,
  type AddIgdbGameDeps,
} from "../collection.service.js";
import * as collectionService from "../collection.service.js";
import type { IgdbGame } from "../../games/igdb/igdb.client.js";

async function cleanup() {
  await db.delete(userGames);
  await db.delete(games);
  await db.delete(users);
}

let seedCounter = 0;
async function seedUser() {
  seedCounter += 1;
  const [u] = await db
    .insert(users)
    .values({
      email: `add-igdb-${seedCounter}@test.com`,
      username: `addigdb${seedCounter}`,
      passwordHash: "x",
    })
    .returning({ id: users.id });
  return u.id;
}

const sampleIgdbGame = (over: Partial<IgdbGame> = {}): IgdbGame => ({
  igdbId: 999,
  name: "Hollow Knight",
  summary: "A bug-themed metroidvania.",
  releaseDate: "2017-02-24",
  rating: 90,
  ratingCount: 200,
  coverImageId: "cover-hk",
  artworkImageId: null,
  developer: "Team Cherry",
  publisher: "Team Cherry",
  genres: [],
  themes: [],
  similarIgdbIds: [],
  hypes: null,
  platformIds: [],
  gameType: null,
  versionParentIgdbId: null,
  ...over,
});

function makeDeps(gamesById: Record<number, IgdbGame>): AddIgdbGameDeps {
  return {
    getToken: vi.fn(async () => "TOKEN"),
    fetchGamesByIds: vi.fn(async (ids: number[]) =>
      ids.map((id) => gamesById[id]).filter((g): g is IgdbGame => g != null),
    ),
    // Neutre par defaut : les tests d'add-from-igdb ne testent pas
    // l'enrichissement, seul le test dedie ci-dessous fournit un spy.
    enrich: vi.fn().mockResolvedValue(undefined),
  };
}

// Laisse le fire-and-forget (void promise.catch()) se resoudre avant les
// assertions : sans ce tick, le spy peut ne pas encore avoir ete appele.
async function flushPromises() {
  await new Promise((resolve) => setImmediate(resolve));
}

beforeEach(cleanup);

describe("addIgdbGameToCollection", () => {
  it("igdbId deja present dans games : pas de recreation, ajoute l'item", async () => {
    const userId = await seedUser();
    const [g] = await db
      .insert(games)
      .values({ title: "Celeste", slug: "celeste-igdb-500", igdbId: 500 })
      .returning({ id: games.id });

    const deps = makeDeps({});
    const res = await addIgdbGameToCollection(userId, { igdbId: 500 }, "CID", deps);

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.item.game.id).toBe(g.id);
    expect(deps.fetchGamesByIds).not.toHaveBeenCalled();

    const rows = await db.select().from(games);
    expect(rows).toHaveLength(1);
  });

  it("igdbId absent : fetch IGDB (mocke), insere le jeu puis l'ajoute", async () => {
    const userId = await seedUser();
    const deps = makeDeps({ 999: sampleIgdbGame() });

    const res = await addIgdbGameToCollection(userId, { igdbId: 999 }, "CID", deps);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.item.game.title).toBe("Hollow Knight");
      expect(res.item.game.igdbId).toBe(999);
    }

    const [created] = await db.select().from(games).where(eq(games.igdbId, 999));
    expect(created).toBeDefined();
    expect(created.slug).toContain("hollow-knight");
    expect(created.developer).toBe("Team Cherry");
    expect(created.releaseStatus).toBe("released");
    expect(created.description).toBe("A bug-themed metroidvania.");
  });

  it("2e ajout identique renvoie conflict", async () => {
    const userId = await seedUser();
    const deps = makeDeps({ 999: sampleIgdbGame() });

    const first = await addIgdbGameToCollection(userId, { igdbId: 999 }, "CID", deps);
    expect(first.ok).toBe(true);

    const second = await addIgdbGameToCollection(userId, { igdbId: 999 }, "CID", deps);
    expect(second).toEqual({ ok: false, reason: "conflict" });
  });

  it("platformId uuid valide mais inexistant : platform_not_found (pas de 500)", async () => {
    const userId = await seedUser();
    const deps = makeDeps({ 999: sampleIgdbGame() });

    const res = await addIgdbGameToCollection(
      userId,
      { igdbId: 999, platformId: "00000000-0000-0000-0000-000000000000" },
      "CID",
      deps,
    );
    expect(res).toEqual({ ok: false, reason: "platform_not_found" });
  });

  it("IGDB ne renvoie rien : igdb_not_found", async () => {
    const userId = await seedUser();
    const deps = makeDeps({});

    const res = await addIgdbGameToCollection(userId, { igdbId: 424242 }, "CID", deps);
    expect(res).toEqual({ ok: false, reason: "igdb_not_found" });
  });

  it("reactive un jeu igdb precedemment ignore au lieu de conflict", async () => {
    const userId = await seedUser();
    const [g] = await db
      .insert(games)
      .values({ title: "Celeste", slug: "celeste-igdb-777", igdbId: 777 })
      .returning({ id: games.id });
    const [ug] = await db
      .insert(userGames)
      .values({ userId, gameId: g.id, status: "abandoned" })
      .returning({ id: userGames.id });
    await ignoreUserGame(userId, ug.id);

    const deps = makeDeps({});
    const res = await addIgdbGameToCollection(userId, { igdbId: 777 }, "CID", deps);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.item.userGameId).toBe(ug.id);
      expect(res.item.status).toBe("abandoned");
    }

    const rows = await db
      .select()
      .from(userGames)
      .where(eq(userGames.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0].excludedAt).toBeNull();
  });

  it("declenche l'enrichissement complet du user apres un ajout manuel", async () => {
    const userId = await seedUser();
    const deps = makeDeps({ 999: sampleIgdbGame() });
    const enrichSpy = vi.fn().mockResolvedValue(undefined);

    const res = await addIgdbGameToCollection(
      userId,
      { igdbId: 999 },
      "CID",
      { ...deps, enrich: enrichSpy },
    );
    await flushPromises();

    expect(res.ok).toBe(true);
    expect(enrichSpy).toHaveBeenCalledWith({ userId });
  });

  it("n'appelle pas l'enrichissement si l'ajout echoue (conflict)", async () => {
    const userId = await seedUser();
    const deps = makeDeps({ 999: sampleIgdbGame() });
    const enrichSpy = vi.fn().mockResolvedValue(undefined);

    await addIgdbGameToCollection(userId, { igdbId: 999 }, "CID", { ...deps, enrich: enrichSpy });
    enrichSpy.mockClear();

    const second = await addIgdbGameToCollection(userId, { igdbId: 999 }, "CID", {
      ...deps,
      enrich: enrichSpy,
    });
    await flushPromises();

    expect(second).toEqual({ ok: false, reason: "conflict" });
    expect(enrichSpy).not.toHaveBeenCalled();
  });
});

async function buildApp() {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);
  await registerSwagger(app);
  await registerJwt(app);
  await app.register(collectionRoutes, { prefix: "/api" });
  await app.ready();
  return app;
}

describe("POST /api/collection/from-igdb", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("401 sans JWT", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/collection/from-igdb",
      payload: { igdbId: 1 },
    });
    expect(res.statusCode).toBe(401);
  });

  it("201 ajoute le jeu", async () => {
    const app = await buildApp();
    // Forme complete d'un CollectionItemDTO (collectionItemSchema) : la reponse
    // etant serialisee/validee par le schema Zod, le mock doit refleter la vraie
    // forme de l'item renvoye par le service, pas un stub partiel.
    const fakeItem = {
      userGameId: "11111111-1111-4111-8111-111111111111",
      status: "backlog",
      playtimeMinutes: null,
      rating: null,
      review: null,
      isHidden: false,
      startedAt: null,
      completedAt: null,
      addedAt: null,
      game: {
        id: "22222222-2222-4222-8222-222222222222",
        title: "Test Game",
        slug: "test-game",
        coverUrl: null,
        backgroundUrl: null,
        releaseDate: null,
        developer: null,
        publisher: null,
        igdbRating: null,
        igdbId: null,
        isEnriched: false,
      },
      genres: [],
      tags: [],
    };
    vi.spyOn(collectionService, "addIgdbGameToCollection").mockResolvedValue({
      ok: true,
      item: fakeItem,
    } as never);
    const token = app.jwt.sign({ sub: "u" });
    const res = await app.inject({
      method: "POST",
      url: "/api/collection/from-igdb",
      headers: { authorization: `Bearer ${token}` },
      payload: { igdbId: 999 },
    });
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body)).toEqual(fakeItem);
  });

  it("404 si le jeu est introuvable sur IGDB", async () => {
    const app = await buildApp();
    vi.spyOn(collectionService, "addIgdbGameToCollection").mockResolvedValue({
      ok: false,
      reason: "igdb_not_found",
    });
    const token = app.jwt.sign({ sub: "u" });
    const res = await app.inject({
      method: "POST",
      url: "/api/collection/from-igdb",
      headers: { authorization: `Bearer ${token}` },
      payload: { igdbId: 424242 },
    });
    expect(res.statusCode).toBe(404);
  });

  it("409 si deja dans la collection", async () => {
    const app = await buildApp();
    vi.spyOn(collectionService, "addIgdbGameToCollection").mockResolvedValue({
      ok: false,
      reason: "conflict",
    });
    const token = app.jwt.sign({ sub: "u" });
    const res = await app.inject({
      method: "POST",
      url: "/api/collection/from-igdb",
      headers: { authorization: `Bearer ${token}` },
      payload: { igdbId: 999 },
    });
    expect(res.statusCode).toBe(409);
  });

  it("404 si la plateforme est introuvable", async () => {
    const app = await buildApp();
    vi.spyOn(collectionService, "addIgdbGameToCollection").mockResolvedValue({
      ok: false,
      reason: "platform_not_found",
    });
    const token = app.jwt.sign({ sub: "u" });
    const res = await app.inject({
      method: "POST",
      url: "/api/collection/from-igdb",
      headers: { authorization: `Bearer ${token}` },
      payload: { igdbId: 999, platformId: "00000000-0000-0000-0000-000000000000" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("400 si igdbId manquant", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({ sub: "u" });
    const res = await app.inject({
      method: "POST",
      url: "/api/collection/from-igdb",
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";
import { validatorCompiler } from "fastify-type-provider-zod";
import { db, users, games, userGames } from "@nextquest/db";
import { eq } from "drizzle-orm";
import { registerJwt } from "../../../plugins/jwt.js";
import { registerErrorHandler } from "../../../lib/error-handler.js";
import { registerSwagger } from "../../../plugins/swagger.js";
import { collectionRoutes } from "../collection.routes.js";
import {
  addIgdbGameToCollection,
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
  ...over,
});

function makeDeps(gamesById: Record<number, IgdbGame>): AddIgdbGameDeps {
  return {
    getToken: vi.fn(async () => "TOKEN"),
    fetchGamesByIds: vi.fn(async (ids: number[]) =>
      ids.map((id) => gamesById[id]).filter((g): g is IgdbGame => g != null),
    ),
  };
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

  it("IGDB ne renvoie rien : igdb_not_found", async () => {
    const userId = await seedUser();
    const deps = makeDeps({});

    const res = await addIgdbGameToCollection(userId, { igdbId: 424242 }, "CID", deps);
    expect(res).toEqual({ ok: false, reason: "igdb_not_found" });
  });
});

async function buildApp() {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
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
    const fakeItem = { userGameId: "ug-1", game: { id: "g-1" } };
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

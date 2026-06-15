# IGDB Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrichir le catalogue `games` avec les métadonnées IGDB (genres, thèmes, jaquette, note joueurs, jeux similaires), de façon découplée de l'import Steam.

**Architecture:** Module `apps/api/src/modules/games/igdb/` calqué sur le module Steam (fonctions pures, `fetchImpl` injectable, config via `process.env`). Token Twitch caché dans Redis. Enrichissement déclenché en fire-and-forget après import + exposé via deux endpoints (self-service user et admin global). Catalogue `games` global partagé = cache naturel.

**Tech Stack:** Fastify 5, Drizzle ORM, Zod, ioredis (déjà en dépendance), Vitest + Supertest, PostgreSQL 16 distant.

**Spec de référence :** `docs/superpowers/specs/2026-06-10-igdb-integration-design.md`

**Prérequis d'exécution :** Postgres + Redis distants up (containers PC). `DATABASE_URL` et `REDIS_URL` dans `.env` racine. Credentials Twitch dans `.env` (`TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`) pour la validation end-to-end manuelle.

---

## File Structure

**Créés :**
- `apps/api/src/lib/redis.ts` — client ioredis lazy (singleton), responsable : accès Redis partagé.
- `apps/api/src/lib/guards.ts` — `requireAuth`, `requireAdmin`, `userIdOf`. Responsable : garde d'autorisation réutilisable.
- `apps/api/src/modules/games/igdb/igdb.auth.ts` — token Twitch + cache Redis.
- `apps/api/src/modules/games/igdb/igdb.client.ts` — requêtes Apicalypse (mapping + fetch), helpers d'URL d'image.
- `apps/api/src/modules/games/igdb/igdb.service.ts` — orchestration `enrichGames`, upsert transactionnel.
- `apps/api/src/modules/games/igdb/igdb.routes.ts` — endpoints user + admin, registre dans server.
- Tests associés sous `__tests__/`.

**Modifiés :**
- `packages/db/src/schema/games.ts` — colonnes `igdbRating`, `igdbRatingCount` + table `gameSimilar`.
- `packages/db/src/schema/services.ts` — colonne `tags.igdbId` + unique `(category, igdbId)`.
- `apps/api/src/server.ts` — register des routes IGDB.
- `apps/api/src/modules/platforms/steam/steam.routes.ts` — hook fire-and-forget après import.
- `.env.example` — placeholders Twitch/IGDB.
- `docs/database/schema.dbml` — documentation des changements.

---

## Task 1: Migration BDD (colonnes games + tags, table game_similar)

**Files:**
- Modify: `packages/db/src/schema/games.ts`
- Modify: `packages/db/src/schema/services.ts`
- Modify: `docs/database/schema.dbml`
- Generate: `packages/db/migrations/<auto>.sql`

- [ ] **Step 1: Ajouter les colonnes IGDB et la table `game_similar` dans `games.ts`**

Dans `packages/db/src/schema/games.ts`, ajouter `real` à l'import drizzle :

```ts
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  real,
  boolean,
  timestamp,
  date,
  index,
  unique,
  primaryKey,
} from "drizzle-orm/pg-core";
```

Dans la définition de `games`, après `avgPlaytime`, ajouter :

```ts
    avgPlaytime: integer("avg_playtime"),
    // Note joueurs IGDB (0-100, decimale) et nombre de votes. Signal qualite
    // exploite par la reco (#58) avec un seuil de votes minimum.
    igdbRating: real("igdb_rating"),
    igdbRatingCount: integer("igdb_rating_count"),
```

À la fin du fichier, après la table `gameUpdates`, ajouter :

```ts
// Jeux similaires suggeres par IGDB. On stocke l'id IGDB brut (et non une FK vers
// games.id) car la plupart des jeux similaires ne sont pas encore dans notre
// catalogue : on n'a que les bibliotheques des users. La reco (#58) resout et
// hydrate ces candidats au moment voulu.
export const gameSimilar = pgTable(
  "game_similar",
  {
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    similarIgdbId: integer("similar_igdb_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.gameId, t.similarIgdbId] }),
    index("game_similar_similar_igdb_id_idx").on(t.similarIgdbId),
  ],
);
```

- [ ] **Step 2: Ajouter `igdbId` + unique `(category, igdbId)` sur `tags` dans `services.ts`**

Dans `packages/db/src/schema/services.ts`, ajouter `index`/`unique` à l'import si absents, et transformer la table `tags` :

```ts
import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";
```

```ts
export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    category: varchar("category", { length: 50 }),
    // Renseigne pour les tags issus d'IGDB (themes au MVP). Permet de dedupliquer
    // par (category, igdb_id) plutot que par slug : evite une collision de slug si
    // on importe plus tard les keywords IGDB (cf. #72).
    igdbId: integer("igdb_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("tags_category_igdb_id_unique").on(t.category, t.igdbId)],
);
```

- [ ] **Step 3: Générer la migration**

Run: `pnpm --filter @nextquest/db db:generate`
Expected: un nouveau fichier `packages/db/migrations/00XX_*.sql` est créé, contenant `ALTER TABLE "games" ADD COLUMN "igdb_rating"...`, `ALTER TABLE "tags" ADD COLUMN "igdb_id"...`, `CREATE TABLE "game_similar"...`.

- [ ] **Step 4: Appliquer la migration sur la BDD distante**

Run: `pnpm --filter @nextquest/db db:migrate`
Expected: migration appliquée sans erreur (`DATABASE_URL` pointe vers le Postgres distant).

- [ ] **Step 5: Documenter dans `schema.dbml`**

Dans `docs/database/schema.dbml`, ajouter sur la table `games` les deux colonnes avec note, et ajouter la table `game_similar` :

```dbml
Table game_similar {
  game_id uuid [not null, ref: > games.id]
  similar_igdb_id integer [not null]

  indexes {
    (game_id, similar_igdb_id) [pk]
    similar_igdb_id
  }
  Note: 'Jeux similaires suggeres par IGDB, stockes en id IGDB brut (pas de FK) car les candidats ne sont pas tous dans notre catalogue. ON DELETE CASCADE sur game_id : supprimer un jeu purge ses liens. Alimente la reco (#58).'
}
```

Sur la table `games`, documenter `igdb_rating` (note joueurs IGDB 0-100) et `igdb_rating_count` (nombre de votes, seuil reco). Sur `tags`, documenter `igdb_id` (dedup des tags IGDB).

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema/games.ts packages/db/src/schema/services.ts packages/db/migrations docs/database/schema.dbml
git commit -m "feat(db): colonnes igdb_rating/count, tags.igdb_id, table game_similar"
```

---

## Task 2: Client Redis partagé

**Files:**
- Create: `apps/api/src/lib/redis.ts`
- Test: `apps/api/src/lib/__tests__/redis.test.ts`

- [ ] **Step 1: Écrire le test (le client expose get/setex et lit REDIS_URL)**

```ts
// apps/api/src/lib/__tests__/redis.test.ts
import { describe, it, expect } from "vitest";
import { redis } from "../redis.js";

describe("redis client", () => {
  it("set/get round-trip avec expiration", async () => {
    await redis.set("nq:test:key", "hello", "EX", 60);
    expect(await redis.get("nq:test:key")).toBe("hello");
    await redis.del("nq:test:key");
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `pnpm --filter @nextquest/api test src/lib/__tests__/redis.test.ts`
Expected: FAIL (`Cannot find module '../redis.js'`).

- [ ] **Step 3: Implémenter le client lazy**

```ts
// apps/api/src/lib/redis.ts
import Redis from "ioredis";

// Singleton lazy : la connexion n'est ouverte qu'au premier acces, comme le client
// db. Evite d'ouvrir une connexion Redis quand le process n'en a pas besoin (ex.
// certains tests unitaires).
let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL is not set");
    _redis = new Redis(url, { maxRetriesPerRequest: 3 });
  }
  return _redis;
}

export const redis = new Proxy({} as Redis, {
  get(_, prop) {
    return (getRedis() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `pnpm --filter @nextquest/api test src/lib/__tests__/redis.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/redis.ts apps/api/src/lib/__tests__/redis.test.ts
git commit -m "feat(api): client redis partage (ioredis, lazy singleton)"
```

---

## Task 3: Auth Twitch avec cache Redis

**Files:**
- Create: `apps/api/src/modules/games/igdb/igdb.auth.ts`
- Test: `apps/api/src/modules/games/igdb/__tests__/igdb.auth.test.ts`

**Interface :** `getTwitchToken(clientId, clientSecret, store, fetchImpl?, tokenUrl?)` où `store` est un objet `{ get(key): Promise<string|null>; set(key, val, mode, ttl): Promise<unknown> }` (compatible ioredis). Renvoie le token en cache si présent, sinon le récupère et le cache.

- [ ] **Step 1: Écrire les tests**

```ts
// apps/api/src/modules/games/igdb/__tests__/igdb.auth.test.ts
import { describe, it, expect, vi } from "vitest";
import { getTwitchToken, TWITCH_TOKEN_CACHE_KEY } from "../igdb.auth.js";

function fakeStore(initial: string | null) {
  const calls = { set: [] as unknown[][] };
  let value = initial;
  return {
    calls,
    get: vi.fn(async () => value),
    set: vi.fn(async (...args: unknown[]) => {
      calls.set.push(args);
      value = args[1] as string;
      return "OK";
    }),
  };
}

const okToken = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

describe("getTwitchToken", () => {
  it("renvoie le token en cache sans appeler Twitch", async () => {
    const store = fakeStore("cached-token");
    const fetchMock = vi.fn();

    const token = await getTwitchToken("id", "secret", store, fetchMock);

    expect(token).toBe("cached-token");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.get).toHaveBeenCalledWith(TWITCH_TOKEN_CACHE_KEY);
  });

  it("recupere et cache le token quand le cache est vide", async () => {
    const store = fakeStore(null);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okToken({ access_token: "fresh", expires_in: 5000000, token_type: "bearer" }));

    const token = await getTwitchToken("myid", "mysecret", store, fetchMock);

    expect(token).toBe("fresh");
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("id.twitch.tv/oauth2/token");
    expect(url).toContain("client_id=myid");
    expect(url).toContain("client_secret=mysecret");
    expect(url).toContain("grant_type=client_credentials");
    // Cache avec un TTL strictement inferieur a expires_in (marge de securite).
    const setArgs = store.calls.set[0];
    expect(setArgs[0]).toBe(TWITCH_TOKEN_CACHE_KEY);
    expect(setArgs[1]).toBe("fresh");
    expect(setArgs[2]).toBe("EX");
    expect(Number(setArgs[3])).toBeGreaterThan(0);
    expect(Number(setArgs[3])).toBeLessThan(5000000);
  });

  it("leve si Twitch repond un statut non-200", async () => {
    const store = fakeStore(null);
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });

    await expect(getTwitchToken("id", "secret", store, fetchMock)).rejects.toThrow(/403/);
  });
});
```

- [ ] **Step 2: Lancer les tests, vérifier l'échec**

Run: `pnpm --filter @nextquest/api test src/modules/games/igdb/__tests__/igdb.auth.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter `igdb.auth.ts`**

```ts
// apps/api/src/modules/games/igdb/igdb.auth.ts
// Authentification IGDB : token applicatif obtenu via Twitch (client_credentials),
// mis en cache dans Redis. Une seule paire client_id/secret pour tout le service.

const TWITCH_TOKEN_URL =
  process.env.TWITCH_TOKEN_URL ?? "https://id.twitch.tv/oauth2/token";

export const TWITCH_TOKEN_CACHE_KEY = "igdb:twitch_token";

// Marge : on expire le cache avant Twitch pour ne jamais envoyer un token tout juste
// perime (l'horloge et la latence peuvent decaler).
const TTL_MARGIN_SECONDS = 24 * 60 * 60; // 1 jour (expires_in ~ 60 jours)

type JsonFetchLike = (
  url: string,
  init?: { method?: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

interface TokenStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "EX", ttl: number): Promise<unknown>;
}

export async function getTwitchToken(
  clientId: string,
  clientSecret: string,
  store: TokenStore,
  fetchImpl: JsonFetchLike = fetch,
  tokenUrl: string = TWITCH_TOKEN_URL,
): Promise<string> {
  const cached = await store.get(TWITCH_TOKEN_CACHE_KEY);
  if (cached) return cached;

  const url = new URL(tokenUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("grant_type", "client_credentials");

  const res = await fetchImpl(url.toString(), { method: "POST" });
  if (!res.ok) {
    throw new Error(`Twitch OAuth a repondu HTTP ${res.status}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };

  const ttl = Math.max(60, data.expires_in - TTL_MARGIN_SECONDS);
  await store.set(TWITCH_TOKEN_CACHE_KEY, data.access_token, "EX", ttl);

  return data.access_token;
}
```

- [ ] **Step 4: Lancer les tests, vérifier qu'ils passent**

Run: `pnpm --filter @nextquest/api test src/modules/games/igdb/__tests__/igdb.auth.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/games/igdb/igdb.auth.ts apps/api/src/modules/games/igdb/__tests__/igdb.auth.test.ts
git commit -m "feat(igdb): token Twitch avec cache Redis"
```

---

## Task 4: Client IGDB (mapping appid + fetch métadonnées)

**Files:**
- Create: `apps/api/src/modules/games/igdb/igdb.client.ts`
- Test: `apps/api/src/modules/games/igdb/__tests__/igdb.client.test.ts`

**Notes :**
- Endpoints : `POST {IGDB_API_BASE}/external_games` et `/games`. En-têtes `Client-ID` + `Authorization: Bearer`. Corps = chaîne Apicalypse.
- `STEAM_EXTERNAL_CATEGORY = 1` : code Steam dans `external_games.category`. **À confirmer en validation manuelle** (Task 9) contre un appid connu ; ajustable si IGDB est passé à `external_game_source`.
- `igdbImageUrl(imageId, size)` construit l'URL CDN.

- [ ] **Step 1: Écrire les tests**

```ts
// apps/api/src/modules/games/igdb/__tests__/igdb.client.test.ts
import { describe, it, expect, vi } from "vitest";
import {
  findGameIdsBySteamAppids,
  fetchGamesByIds,
  igdbImageUrl,
} from "../igdb.client.js";

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const err = (status: number) => ({ ok: false, status, json: async () => ({}) });

describe("igdbImageUrl", () => {
  it("construit l'URL CDN a partir de l'image_id et de la taille", () => {
    expect(igdbImageUrl("abc123", "t_cover_big")).toBe(
      "https://images.igdb.com/igdb/image/upload/t_cover_big/abc123.jpg",
    );
  });
});

describe("findGameIdsBySteamAppids", () => {
  it("mappe appid -> igdbId via external_games", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      ok([
        { id: 1, game: 1020, uid: "570" },
        { id: 2, game: 7346, uid: "730" },
      ]),
    );

    const map = await findGameIdsBySteamAppids([570, 730], "TOKEN", "CID", fetchMock);

    expect(map.get(570)).toBe(1020);
    expect(map.get(730)).toBe(7346);
    // En-tetes d'auth presents
    const init = fetchMock.mock.calls[0][1];
    expect(init.headers["Client-ID"]).toBe("CID");
    expect(init.headers["Authorization"]).toBe("Bearer TOKEN");
    // Le corps filtre sur la categorie Steam et les uid demandes
    expect(init.body).toContain("external_games");
    expect(init.body).toMatch(/uid = \("570","730"\)/);
  });

  it("renvoie une map vide pour une liste vide (aucun appel)", async () => {
    const fetchMock = vi.fn();
    const map = await findGameIdsBySteamAppids([], "TOKEN", "CID", fetchMock);
    expect(map.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("leve si IGDB repond non-200", async () => {
    const fetchMock = vi.fn().mockResolvedValue(err(500));
    await expect(
      findGameIdsBySteamAppids([570], "TOKEN", "CID", fetchMock),
    ).rejects.toThrow(/500/);
  });
});

describe("fetchGamesByIds", () => {
  it("parse les champs IGDB en objet typé", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      ok([
        {
          id: 1020,
          name: "Grand Theft Auto V",
          summary: "Open world.",
          first_release_date: 1379376000,
          rating: 92.3,
          rating_count: 1500,
          cover: { id: 1, image_id: "cover123" },
          artworks: [{ id: 9, image_id: "art456" }],
          genres: [{ id: 5, name: "Shooter", slug: "shooter" }],
          themes: [{ id: 1, name: "Action", slug: "action" }],
          involved_companies: [
            { company: { name: "Rockstar North" }, developer: true, publisher: false },
            { company: { name: "Rockstar Games" }, developer: false, publisher: true },
          ],
          similar_games: [11, 22, 33],
        },
      ]),
    );

    const [g] = await fetchGamesByIds([1020], "TOKEN", "CID", fetchMock);

    expect(g.igdbId).toBe(1020);
    expect(g.name).toBe("Grand Theft Auto V");
    expect(g.summary).toBe("Open world.");
    expect(g.releaseDate).toBe("2013-09-17");
    expect(g.rating).toBe(92.3);
    expect(g.ratingCount).toBe(1500);
    expect(g.coverImageId).toBe("cover123");
    expect(g.artworkImageId).toBe("art456");
    expect(g.genres).toEqual([{ igdbId: 5, name: "Shooter", slug: "shooter" }]);
    expect(g.themes).toEqual([{ igdbId: 1, name: "Action", slug: "action" }]);
    expect(g.developer).toBe("Rockstar North");
    expect(g.publisher).toBe("Rockstar Games");
    expect(g.similarIgdbIds).toEqual([11, 22, 33]);
  });

  it("tolère les champs absents (jeu minimal)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([{ id: 99, name: "X" }]));
    const [g] = await fetchGamesByIds([99], "TOKEN", "CID", fetchMock);
    expect(g.igdbId).toBe(99);
    expect(g.releaseDate).toBeNull();
    expect(g.coverImageId).toBeNull();
    expect(g.genres).toEqual([]);
    expect(g.similarIgdbIds).toEqual([]);
  });
});
```

- [ ] **Step 2: Lancer les tests, vérifier l'échec**

Run: `pnpm --filter @nextquest/api test src/modules/games/igdb/__tests__/igdb.client.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter `igdb.client.ts`**

```ts
// apps/api/src/modules/games/igdb/igdb.client.ts
// Wrapper sur l'API IGDB v4 (Apicalypse). Fonctions pures, fetch injectable pour les
// tests. Une requete = un appel ; le decoupage en lots de 500 et le throttling sont
// geres par le service appelant.

const IGDB_API_BASE = process.env.IGDB_API_BASE ?? "https://api.igdb.com/v4";

// Code Steam dans external_games.category. A confirmer en validation manuelle ;
// IGDB migre progressivement vers external_game_source (Steam = 1 egalement).
export const STEAM_EXTERNAL_CATEGORY = 1;

type JsonFetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface IgdbTaxon {
  igdbId: number;
  name: string;
  slug: string;
}

export interface IgdbGame {
  igdbId: number;
  name: string;
  summary: string | null;
  releaseDate: string | null; // YYYY-MM-DD
  rating: number | null;
  ratingCount: number | null;
  coverImageId: string | null;
  artworkImageId: string | null;
  developer: string | null;
  publisher: string | null;
  genres: IgdbTaxon[];
  themes: IgdbTaxon[];
  similarIgdbIds: number[];
}

export function igdbImageUrl(imageId: string, size: string): string {
  return `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg`;
}

async function igdbPost(
  endpoint: string,
  body: string,
  token: string,
  clientId: string,
  fetchImpl: JsonFetchLike,
): Promise<unknown> {
  const res = await fetchImpl(`${IGDB_API_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`IGDB ${endpoint} a repondu HTTP ${res.status}`);
  }
  return res.json();
}

// Map appid Steam -> id de jeu IGDB. Les appids absents d'IGDB ne figurent pas dans
// la map (gere comme "introuvable" cote service).
export async function findGameIdsBySteamAppids(
  appids: number[],
  token: string,
  clientId: string,
  fetchImpl: JsonFetchLike = fetch as unknown as JsonFetchLike,
): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  if (appids.length === 0) return result;

  const uidList = appids.map((a) => `"${a}"`).join(",");
  const body = `fields game,uid; where category = ${STEAM_EXTERNAL_CATEGORY} & uid = (${uidList}); limit 500;`;

  const rows = (await igdbPost("external_games", body, token, clientId, fetchImpl)) as Array<{
    game?: number;
    uid?: string;
  }>;

  for (const row of rows) {
    if (row.game != null && row.uid != null) {
      result.set(Number(row.uid), row.game);
    }
  }
  return result;
}

const GAME_FIELDS = [
  "name",
  "summary",
  "first_release_date",
  "rating",
  "rating_count",
  "cover.image_id",
  "artworks.image_id",
  "genres.name",
  "genres.slug",
  "themes.name",
  "themes.slug",
  "involved_companies.company.name",
  "involved_companies.developer",
  "involved_companies.publisher",
  "similar_games",
].join(",");

interface RawTaxon {
  id: number;
  name: string;
  slug: string;
}
interface RawGame {
  id: number;
  name: string;
  summary?: string;
  first_release_date?: number;
  rating?: number;
  rating_count?: number;
  cover?: { image_id?: string };
  artworks?: Array<{ image_id?: string }>;
  genres?: RawTaxon[];
  themes?: RawTaxon[];
  involved_companies?: Array<{
    company?: { name?: string };
    developer?: boolean;
    publisher?: boolean;
  }>;
  similar_games?: number[];
}

function mapTaxa(raw: RawTaxon[] | undefined): IgdbTaxon[] {
  return (raw ?? []).map((t) => ({ igdbId: t.id, name: t.name, slug: t.slug }));
}

function unixToDate(unix: number | undefined): string | null {
  if (unix == null) return null;
  return new Date(unix * 1000).toISOString().slice(0, 10);
}

export async function fetchGamesByIds(
  igdbIds: number[],
  token: string,
  clientId: string,
  fetchImpl: JsonFetchLike = fetch as unknown as JsonFetchLike,
): Promise<IgdbGame[]> {
  if (igdbIds.length === 0) return [];

  const body = `fields ${GAME_FIELDS}; where id = (${igdbIds.join(",")}); limit 500;`;
  const rows = (await igdbPost("games", body, token, clientId, fetchImpl)) as RawGame[];

  return rows.map((r) => {
    const dev = r.involved_companies?.find((c) => c.developer)?.company?.name ?? null;
    const pub = r.involved_companies?.find((c) => c.publisher)?.company?.name ?? null;
    return {
      igdbId: r.id,
      name: r.name,
      summary: r.summary ?? null,
      releaseDate: unixToDate(r.first_release_date),
      rating: r.rating ?? null,
      ratingCount: r.rating_count ?? null,
      coverImageId: r.cover?.image_id ?? null,
      artworkImageId: r.artworks?.[0]?.image_id ?? null,
      developer: dev,
      publisher: pub,
      genres: mapTaxa(r.genres),
      themes: mapTaxa(r.themes),
      similarIgdbIds: r.similar_games ?? [],
    };
  });
}
```

- [ ] **Step 4: Lancer les tests, vérifier qu'ils passent**

Run: `pnpm --filter @nextquest/api test src/modules/games/igdb/__tests__/igdb.client.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/games/igdb/igdb.client.ts apps/api/src/modules/games/igdb/__tests__/igdb.client.test.ts
git commit -m "feat(igdb): client Apicalypse (mapping appid + fetch metadonnees)"
```

---

## Task 5: Service d'enrichissement (`enrichGames`)

**Files:**
- Create: `apps/api/src/modules/games/igdb/igdb.service.ts`
- Test: `apps/api/src/modules/games/igdb/__tests__/igdb.service.test.ts`

**Conception :** `enrichGames` est injectable pour les tests : on lui passe le token et un `client` (les deux fonctions du Task 4). Il sélectionne les jeux à enrichir (par user ou global), mappe les appids manquants, fetch en lots de 500, et upsert dans une transaction. Renvoie un résumé `{ scanned, mapped, enriched, notFound, failed }`.

- [ ] **Step 1: Écrire les tests d'intégration (vraie BDD, client mocké)**

```ts
// apps/api/src/modules/games/igdb/__tests__/igdb.service.test.ts
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
    sleep: async () => {},
  };
}

beforeEach(cleanup);

describe("enrichGames (scopé user)", () => {
  it("mappe, fetch et upsert les metadonnees + genres + themes + similar", async () => {
    const userId = await createUser();
    const gameId = await seedGame(3498, "GTA V");
    // user possede le jeu
    const [{ id: serviceNull }] = [{ id: null as unknown as string }];
    void serviceNull;
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
```

- [ ] **Step 2: Lancer les tests, vérifier l'échec**

Run: `pnpm --filter @nextquest/api test src/modules/games/igdb/__tests__/igdb.service.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter `igdb.service.ts`**

```ts
// apps/api/src/modules/games/igdb/igdb.service.ts
import {
  db,
  games,
  userGames,
  genres,
  gameGenres,
  tags,
  gameTags,
  gameSimilar,
} from "@nextquest/db";
import { and, eq, inArray, isNull, or, lt, sql } from "drizzle-orm";
import {
  igdbImageUrl,
  findGameIdsBySteamAppids,
  fetchGamesByIds,
  type IgdbGame,
} from "./igdb.client.js";
import { getTwitchToken } from "./igdb.auth.js";
import { redis } from "../../../lib/redis.js";

// Jeux re-synchronises au-dela de ce delai (garde-fou de fraicheur). Au MVP la
// re-sync periodique n'est pas branchee (cf. #70) ; ce seuil n'agit que si un jeu
// est rescanne explicitement.
const STALE_DAYS = 30;
const BATCH = 500;

export interface EnrichSummary {
  scanned: number;
  mapped: number;
  enriched: number;
  notFound: number;
  failed: number;
}

// Client injectable : en prod, valeurs reelles (Twitch + IGDB) ; en test, mocks.
export interface IgdbDeps {
  getToken(): Promise<string>;
  findGameIdsBySteamAppids(appids: number[], token: string, clientId: string): Promise<Map<number, number>>;
  fetchGamesByIds(ids: number[], token: string, clientId: string): Promise<IgdbGame[]>;
  sleep(ms: number): Promise<void>;
}

export function defaultDeps(): IgdbDeps {
  return {
    getToken: () =>
      getTwitchToken(
        process.env.TWITCH_CLIENT_ID ?? "",
        process.env.TWITCH_CLIENT_SECRET ?? "",
        redis as unknown as {
          get(k: string): Promise<string | null>;
          set(k: string, v: string, m: "EX", t: number): Promise<unknown>;
        },
      ),
    findGameIdsBySteamAppids: (appids, token, clientId) =>
      findGameIdsBySteamAppids(appids, token, clientId),
    fetchGamesByIds: (ids, token, clientId) => fetchGamesByIds(ids, token, clientId),
    // Pacing pour rester sous 4 req/s entre deux lots.
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Selectionne les jeux a enrichir : jamais hydrates (igdb_id null) ou perimes.
// Scopé a la biblio d'un user si userId fourni, sinon global (catalogue complet).
async function selectCandidates(userId?: string) {
  const staleCutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);
  const freshness = or(isNull(games.igdbId), lt(games.lastSyncedAt, staleCutoff));

  if (userId) {
    const rows = await db
      .selectDistinct({ id: games.id, steamAppid: games.steamAppid, igdbId: games.igdbId })
      .from(games)
      .innerJoin(userGames, eq(userGames.gameId, games.id))
      .where(and(eq(userGames.userId, userId), freshness));
    return rows;
  }
  return db
    .select({ id: games.id, steamAppid: games.steamAppid, igdbId: games.igdbId })
    .from(games)
    .where(freshness);
}

// Upsert d'un jeu enrichi + ses genres/themes/similar, dans une transaction.
async function upsertEnrichedGame(gameId: string, data: IgdbGame): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(games)
      .set({
        igdbId: data.igdbId,
        description: data.summary,
        releaseDate: data.releaseDate,
        igdbRating: data.rating,
        igdbRatingCount: data.ratingCount,
        developer: data.developer,
        publisher: data.publisher,
        coverUrl: data.coverImageId ? igdbImageUrl(data.coverImageId, "t_cover_big") : null,
        backgroundUrl: data.artworkImageId ? igdbImageUrl(data.artworkImageId, "t_1080p") : null,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(games.id, gameId));

    // Genres : upsert par slug (contrainte unique existante), puis liaison.
    if (data.genres.length > 0) {
      const genreRows = await tx
        .insert(genres)
        .values(data.genres.map((g) => ({ name: g.name, slug: g.slug, igdbId: g.igdbId })))
        .onConflictDoUpdate({
          target: genres.slug,
          set: { igdbId: sql.raw(`excluded.${genres.igdbId.name}`) },
        })
        .returning({ id: genres.id });
      await tx
        .insert(gameGenres)
        .values(genreRows.map((r) => ({ gameId, genreId: r.id })))
        .onConflictDoNothing();
    }

    // Themes : stockes dans tags(category='theme'), dedup par (category, igdb_id).
    if (data.themes.length > 0) {
      const themeRows = await tx
        .insert(tags)
        .values(
          data.themes.map((t) => ({
            name: t.name,
            slug: t.slug,
            category: "theme",
            igdbId: t.igdbId,
          })),
        )
        .onConflictDoUpdate({
          target: [tags.category, tags.igdbId],
          set: { name: sql.raw(`excluded.${tags.name.name}`) },
        })
        .returning({ id: tags.id });
      await tx
        .insert(gameTags)
        .values(themeRows.map((r) => ({ gameId, tagId: r.id })))
        .onConflictDoNothing();
    }

    // Similar : on remplace l'ensemble des liens du jeu (source de verite = IGDB).
    await tx.delete(gameSimilar).where(eq(gameSimilar.gameId, gameId));
    if (data.similarIgdbIds.length > 0) {
      await tx
        .insert(gameSimilar)
        .values(data.similarIgdbIds.map((similarIgdbId) => ({ gameId, similarIgdbId })))
        .onConflictDoNothing();
    }
  });
}

export async function enrichGames(
  opts: { userId?: string },
  clientId: string = process.env.TWITCH_CLIENT_ID ?? "",
  deps: IgdbDeps = defaultDeps(),
): Promise<EnrichSummary> {
  const summary: EnrichSummary = { scanned: 0, mapped: 0, enriched: 0, notFound: 0, failed: 0 };

  const candidates = await selectCandidates(opts.userId);
  summary.scanned = candidates.length;
  if (candidates.length === 0) return summary;

  const token = await deps.getToken();

  // 1) Mapping appid -> igdbId pour les jeux qui ont un appid mais pas d'igdbId.
  const needMapping = candidates.filter((c) => c.igdbId == null && c.steamAppid != null);
  const appidToIgdb = new Map<number, number>();
  for (const part of chunk(needMapping.map((c) => c.steamAppid as number), BATCH)) {
    const m = await deps.findGameIdsBySteamAppids(part, token, clientId);
    for (const [k, v] of m) appidToIgdb.set(k, v);
    await deps.sleep(250);
  }

  // Resoudre l'igdbId final de chaque candidat (existant ou nouvellement mappe).
  const resolved = candidates
    .map((c) => ({
      gameId: c.id,
      igdbId: c.igdbId ?? (c.steamAppid != null ? appidToIgdb.get(c.steamAppid) ?? null : null),
    }))
    .filter((c): c is { gameId: string; igdbId: number } => c.igdbId != null);
  summary.mapped = resolved.length;

  // Jeux non resolus : introuvables sur IGDB -> marquer last_synced_at.
  const unresolvedIds = candidates
    .filter((c) => !resolved.some((r) => r.gameId === c.id))
    .map((c) => c.id);
  summary.notFound = unresolvedIds.length;
  if (unresolvedIds.length > 0) {
    await db
      .update(games)
      .set({ lastSyncedAt: new Date() })
      .where(inArray(games.id, unresolvedIds));
  }

  // 2) Fetch metadonnees en lots, puis upsert.
  const igdbIdToGameIds = new Map<number, string[]>();
  for (const r of resolved) {
    const list = igdbIdToGameIds.get(r.igdbId) ?? [];
    list.push(r.gameId);
    igdbIdToGameIds.set(r.igdbId, list);
  }

  for (const part of chunk([...igdbIdToGameIds.keys()], BATCH)) {
    let fetched: IgdbGame[];
    try {
      fetched = await deps.fetchGamesByIds(part, token, clientId);
    } catch {
      summary.failed += part.length;
      continue; // IGDB en panne sur ce lot : on n'ecrit rien, retente plus tard.
    }
    for (const data of fetched) {
      for (const gameId of igdbIdToGameIds.get(data.igdbId) ?? []) {
        await upsertEnrichedGame(gameId, data);
        summary.enriched += 1;
      }
    }
    await deps.sleep(250);
  }

  return summary;
}
```

- [ ] **Step 4: Lancer les tests, vérifier qu'ils passent**

Run: `pnpm --filter @nextquest/api test src/modules/games/igdb/__tests__/igdb.service.test.ts`
Expected: PASS (4 tests). Si un échec porte sur `onConflictDoUpdate` (cible non unique), vérifier que la migration du Task 1 a bien créé `tags_category_igdb_id_unique` et est appliquée.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/games/igdb/igdb.service.ts apps/api/src/modules/games/igdb/__tests__/igdb.service.test.ts
git commit -m "feat(igdb): service enrichGames (mapping + upsert metadonnees scopé/global)"
```

---

## Task 6: Guards d'autorisation partagés (`requireAuth`, `requireAdmin`)

**Files:**
- Create: `apps/api/src/lib/guards.ts`
- Test: `apps/api/src/lib/__tests__/guards.test.ts`

- [ ] **Step 1: Écrire le test (route protégée admin)**

```ts
// apps/api/src/lib/__tests__/guards.test.ts
import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { registerJwt } from "../../plugins/jwt.js";
import { requireAuth, requireAdmin } from "../guards.js";

async function buildApp() {
  const app = Fastify();
  await registerJwt(app);
  app.get("/admin-only", { onRequest: [requireAuth, requireAdmin] }, async () => ({ ok: true }));
  await app.ready();
  return app;
}

describe("requireAdmin", () => {
  it("401 sans token", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/admin-only" });
    expect(res.statusCode).toBe(401);
  });

  it("403 pour un user non admin", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({ sub: "u1", role: "user" });
    const res = await app.inject({
      method: "GET",
      url: "/admin-only",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("200 pour un admin", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({ sub: "u1", role: "admin" });
    const res = await app.inject({
      method: "GET",
      url: "/admin-only",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `pnpm --filter @nextquest/api test src/lib/__tests__/guards.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter `guards.ts`**

```ts
// apps/api/src/lib/guards.ts
// Gardes d'autorisation reutilisables. requireAuth verifie le JWT ; requireAdmin
// s'execute ensuite et lit le role porte par le token (signe { sub, role }).
import type { FastifyReply, FastifyRequest } from "fastify";

export const requireAuth = async (req: FastifyRequest) => {
  await req.jwtVerify();
};

export const requireAdmin = async (req: FastifyRequest, reply: FastifyReply) => {
  const role = (req.user as { role?: string } | undefined)?.role;
  if (role !== "admin") {
    return reply.code(403).send({ error: "Acces reserve aux administrateurs" });
  }
};

export function userIdOf(request: FastifyRequest): string {
  return (request.user as { sub: string }).sub;
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `pnpm --filter @nextquest/api test src/lib/__tests__/guards.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/guards.ts apps/api/src/lib/__tests__/guards.test.ts
git commit -m "feat(api): guards partages requireAuth/requireAdmin"
```

---

## Task 7: Routes IGDB (user self-service + admin global)

**Files:**
- Create: `apps/api/src/modules/games/igdb/igdb.routes.ts`
- Modify: `apps/api/src/server.ts`
- Test: `apps/api/src/modules/games/igdb/__tests__/igdb.routes.test.ts`

- [ ] **Step 1: Écrire les tests de routes**

```ts
// apps/api/src/modules/games/igdb/__tests__/igdb.routes.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";
import { registerJwt } from "../../../../plugins/jwt.js";
import { registerRateLimit } from "../../../../plugins/rate-limit.js";
import { igdbRoutes } from "../igdb.routes.js";
import * as service from "../igdb.service.js";

vi.spyOn(service, "enrichGames").mockResolvedValue({
  scanned: 1,
  mapped: 1,
  enriched: 1,
  notFound: 0,
  failed: 0,
});

async function buildApp() {
  const app = Fastify();
  await registerJwt(app);
  await registerRateLimit(app);
  await app.register(igdbRoutes, { prefix: "/api" });
  await app.ready();
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/users/me/library/enrich", () => {
  it("401 sans token", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "POST", url: "/api/users/me/library/enrich" });
    expect(res.statusCode).toBe(401);
  });

  it("appelle enrichGames scopé au user et renvoie le résumé", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({ sub: "user-123", role: "user" });
    const res = await app.inject({
      method: "POST",
      url: "/api/users/me/library/enrich",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ enriched: 1 });
    expect(service.enrichGames).toHaveBeenCalledWith({ userId: "user-123" });
  });
});

describe("POST /api/admin/games/enrich", () => {
  it("403 pour un user non admin", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({ sub: "u", role: "user" });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/games/enrich",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    expect(service.enrichGames).not.toHaveBeenCalled();
  });

  it("appelle enrichGames global pour un admin", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({ sub: "admin-1", role: "admin" });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/games/enrich",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(service.enrichGames).toHaveBeenCalledWith({});
  });
});
```

- [ ] **Step 2: Lancer les tests, vérifier l'échec**

Run: `pnpm --filter @nextquest/api test src/modules/games/igdb/__tests__/igdb.routes.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter `igdb.routes.ts`**

```ts
// apps/api/src/modules/games/igdb/igdb.routes.ts
import type { FastifyInstance } from "fastify";
import { requireAuth, requireAdmin, userIdOf } from "../../../lib/guards.js";
import { enrichGames } from "./igdb.service.js";

export async function igdbRoutes(app: FastifyInstance) {
  // Self-service : l'user rafraichit les metadonnees de SA bibliotheque.
  app.post(
    "/users/me/library/enrich",
    {
      onRequest: [requireAuth],
      preHandler: app.rateLimit({ max: 5, timeWindow: "1 minute" }),
      schema: {
        tags: ["Games"],
        summary: "Enrichir (IGDB) la bibliotheque de l'utilisateur",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      return enrichGames({ userId: userIdOf(request) });
    },
  );

  // Admin : enrichit / re-synchronise tout le catalogue.
  app.post(
    "/admin/games/enrich",
    {
      onRequest: [requireAuth, requireAdmin],
      preHandler: app.rateLimit({ max: 2, timeWindow: "1 minute" }),
      schema: {
        tags: ["Admin"],
        summary: "Enrichir (IGDB) tout le catalogue",
        security: [{ bearerAuth: [] }],
      },
    },
    async () => {
      return enrichGames({});
    },
  );
}
```

- [ ] **Step 4: Enregistrer les routes dans `server.ts`**

Dans `apps/api/src/server.ts`, ajouter l'import après les autres modules :

```ts
import { igdbRoutes } from "./modules/games/igdb/igdb.routes.js";
```

Et le register avec les autres routes (avant `oauthRoutes`) :

```ts
  await app.register(steamRoutes, { prefix: "/api" });
  await app.register(igdbRoutes, { prefix: "/api" });
  await app.register(oauthRoutes, { prefix: "/api/auth" });
```

- [ ] **Step 5: Lancer les tests, vérifier qu'ils passent**

Run: `pnpm --filter @nextquest/api test src/modules/games/igdb/__tests__/igdb.routes.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/games/igdb/igdb.routes.ts apps/api/src/server.ts apps/api/src/modules/games/igdb/__tests__/igdb.routes.test.ts
git commit -m "feat(igdb): routes enrich self-service + admin global"
```

---

## Task 8: Hook fire-and-forget après import Steam

**Files:**
- Modify: `apps/api/src/modules/platforms/steam/steam.routes.ts`
- Test: `apps/api/src/modules/platforms/steam/__tests__/steam.routes.test.ts` (ajout)

- [ ] **Step 1: Écrire le test (l'import déclenche enrichGames sans bloquer)**

Dans `steam.routes.test.ts`, ajouter le mock du service IGDB en haut (après les mocks Steam existants) :

```ts
import * as igdbService from "../../../games/igdb/igdb.service.js";
vi.mock("../../../games/igdb/igdb.service.js", () => ({
  enrichGames: vi.fn().mockResolvedValue({ scanned: 0, mapped: 0, enriched: 0, notFound: 0, failed: 0 }),
}));
```

Puis ajouter un test dans le `describe` de l'import (réutilise les helpers `buildApp`, `createUserAndToken`, et le mock `mockedGetOwnedGames` existants) :

```ts
it("declenche l'enrichissement IGDB en fire-and-forget apres import", async () => {
  const app = await buildApp();
  const { userId, token } = await createUserAndToken(app);
  await linkSteamAccount(userId, "76561198000000000", "Gaben");
  mockedGetOwnedGames.mockResolvedValue([
    { appid: 570, name: "Dota 2", playtimeMinutes: 1200 },
  ]);

  const res = await app.inject({
    method: "POST",
    url: "/api/platforms/steam/import",
    headers: { authorization: `Bearer ${token}` },
  });

  expect(res.statusCode).toBe(200);
  expect(igdbService.enrichGames).toHaveBeenCalledWith({ userId });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `pnpm --filter @nextquest/api test src/modules/platforms/steam/__tests__/steam.routes.test.ts`
Expected: FAIL (`enrichGames` non appelé / import non câblé).

- [ ] **Step 3: Câbler le hook dans `steam.routes.ts`**

Ajouter l'import en haut du fichier :

```ts
import { enrichGames } from "../../games/igdb/igdb.service.js";
```

Dans le handler `/platforms/steam/import`, remplacer la fin :

```ts
      const imported = await importSteamLibrary(userId, ownedGames);
      return reply.send({ imported });
```

par :

```ts
      const imported = await importSteamLibrary(userId, ownedGames);

      // Enrichissement IGDB en fire-and-forget : on ne bloque pas la reponse (l'user
      // voit sa biblio tout de suite, les metadonnees arrivent apres). La pass est
      // idempotente, un echec est rattrape au prochain import/declenchement manuel.
      void enrichGames({ userId }).catch((err) => {
        request.log.error({ err }, "Enrichissement IGDB post-import echoue");
      });

      return reply.send({ imported });
```

- [ ] **Step 4: Lancer les tests Steam, vérifier qu'ils passent**

Run: `pnpm --filter @nextquest/api test src/modules/platforms/steam/__tests__/steam.routes.test.ts`
Expected: PASS (tous les tests Steam, dont le nouveau).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/platforms/steam/steam.routes.ts apps/api/src/modules/platforms/steam/__tests__/steam.routes.test.ts
git commit -m "feat(steam): declenche l'enrichissement IGDB en fire-and-forget apres import"
```

---

## Task 9: Config `.env.example` + validation end-to-end manuelle

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Ajouter les placeholders Twitch/IGDB dans `.env.example`**

Après le bloc Steam, ajouter :

```
# IGDB — via Twitch (https://dev.twitch.tv/console/apps)
# Sert a enrichir le catalogue (metadonnees, genres, themes, note joueurs, similar).
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
# Optionnels, defaut en dur (URLs officielles) :
IGDB_API_BASE=https://api.igdb.com/v4
TWITCH_TOKEN_URL=https://id.twitch.tv/oauth2/token
```

- [ ] **Step 2: Confirmer le code Steam de `external_games` (validation manuelle)**

Avec de vrais credentials Twitch dans `.env`, lancer un petit script ou utiliser l'endpoint admin contre un jeu Steam connu (ex. Hades, appid `1145360`) et vérifier que `findGameIdsBySteamAppids([1145360], ...)` renvoie bien un igdbId.
- Si la map est vide : IGDB est probablement passé à `external_game_source`. Adapter `igdb.client.ts` : remplacer `where category = ${STEAM_EXTERNAL_CATEGORY}` par `where external_game_source = ${STEAM_EXTERNAL_CATEGORY}` et relancer.
- Documenter la valeur confirmée en commentaire dans `igdb.client.ts`.

- [ ] **Step 3: Vérifier la suite complète**

Run: `pnpm --filter @nextquest/api test`
Expected: tous les tests verts (Steam + IGDB + guards + redis + auth).

Run: `pnpm --filter @nextquest/api typecheck`
Expected: aucune erreur TypeScript.

Run: `pnpm --filter @nextquest/api lint`
Expected: aucune erreur ESLint.

- [ ] **Step 4: Commit**

```bash
git add .env.example apps/api/src/modules/games/igdb/igdb.client.ts
git commit -m "chore(igdb): placeholders Twitch dans .env.example + code Steam confirme"
```

---

## Self-Review (rempli pendant l'écriture du plan)

**Spec coverage :**
- Module `games/igdb/` (auth/client/service/routes) → Tasks 3,4,5,7. ✓
- Token Twitch caché Redis → Tasks 2,3. ✓
- Mapping appid via external_games → Task 4. ✓
- Note joueurs `rating`/`rating_count` → games.igdbRating/Count, Tasks 1,5. ✓
- Thèmes dans tags(category='theme'), dédup (category, igdbId) → Tasks 1,5. ✓
- similar_games en ids bruts (game_similar) → Tasks 1,5. ✓
- Enrichissement découplé, fire-and-forget → Task 8. ✓
- Endpoint self-service user + admin global + requireAdmin → Tasks 6,7. ✓
- Robustesse (introuvable vs panne) → Task 5 (notFound marque last_synced_at ; failed n'écrit rien). ✓
- schema.dbml + .env.example → Tasks 1,9. ✓
- Rate limit (pacing 4 req/s) → Task 5 (chunk 500 + sleep 250ms entre lots). ✓

**Cohérence des types :** `IgdbGame`/`IgdbTaxon` définis en Task 4, consommés en Task 5. `EnrichSummary` défini en Task 5, consommé en Task 7. `enrichGames({ userId })` (scopé) et `enrichGames({})` (global) cohérents entre Tasks 5, 7, 8.

**Point ouvert assumé :** code Steam `external_games` confirmé en Task 9 step 2 (pas un placeholder : valeur par défaut `1` fonctionnelle, procédure de correction documentée).

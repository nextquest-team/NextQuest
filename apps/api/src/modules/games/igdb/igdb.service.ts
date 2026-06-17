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
  fetchTimeToBeats,
  type IgdbGame,
} from "./igdb.client.js";
import { getTwitchToken } from "./igdb.auth.js";
import { redis } from "../../../lib/redis.js";

// Jeux re-synchronises au-dela de ce delai (garde-fou de fraicheur). Au MVP la
// re-sync periodique n'est pas branchee (cf. #70) ; ce seuil n'agit que si un jeu
// est rescanne explicitement.
const STALE_DAYS = 30;
const BATCH = 500;
// Pause entre deux lots pour rester sous la limite IGDB de 4 req/s.
const SLEEP_MS_BETWEEN_BATCHES = 250;

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
  fetchTimeToBeats(ids: number[], token: string, clientId: string): Promise<Map<number, { normallyMinutes: number; count: number }>>;
  sleep(ms: number): Promise<void>;
}

export function defaultDeps(): IgdbDeps {
  return {
    getToken: () => {
      // Pont de typage : l'interface ioredis est large ; cette forme reduite suffit
      // au cache du token et reste testable. Utilise seulement en prod (les tests
      // injectent un mock via deps).
      const redisStore = redis as unknown as {
        get(k: string): Promise<string | null>;
        set(k: string, v: string, m: "EX", t: number): Promise<unknown>;
      };
      return getTwitchToken(
        process.env.TWITCH_CLIENT_ID ?? "",
        process.env.TWITCH_CLIENT_SECRET ?? "",
        redisStore,
      );
    },
    findGameIdsBySteamAppids: (appids, token, clientId) =>
      findGameIdsBySteamAppids(appids, token, clientId),
    fetchGamesByIds: (ids, token, clientId) => fetchGamesByIds(ids, token, clientId),
    fetchTimeToBeats: (ids, token, clientId) => fetchTimeToBeats(ids, token, clientId),
    // Pacing pour rester sous 4 req/s entre deux lots.
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Selectionne les jeux a enrichir : jamais hydrates (igdb_id null), jamais
// synchronises (last_synced_at null) ou perimes. Le cas last_synced_at null est
// explicite car en SQL `null < staleCutoff` vaut NULL (donc non selectionne par
// le seul lt) : un jeu avec un igdb_id mais jamais synchronise resterait sinon
// invisible pour l'enrichissement.
// Scopé a la biblio d'un user si userId fourni, sinon global (catalogue complet).
async function selectCandidates(userId?: string) {
  const staleCutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);
  const freshness = or(
    isNull(games.igdbId),
    isNull(games.lastSyncedAt),
    lt(games.lastSyncedAt, staleCutoff),
  );

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
async function upsertEnrichedGame(
  gameId: string,
  data: IgdbGame,
  avgPlaytime: number | null = null,
  igdbHypes: number | null = null,
): Promise<void> {
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
        avgPlaytime: avgPlaytime,
        igdbHypes: igdbHypes,
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
    await deps.sleep(SLEEP_MS_BETWEEN_BATCHES);
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
  const resolvedIds = new Set(resolved.map((r) => r.gameId));
  const unresolvedIds = candidates
    .filter((c) => !resolvedIds.has(c.id))
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
    let timeToBeat: Map<number, { normallyMinutes: number; count: number }>;
    try {
      fetched = await deps.fetchGamesByIds(part, token, clientId);
      timeToBeat = await deps.fetchTimeToBeats(part, token, clientId);
    } catch {
      summary.failed += part.length;
      continue; // IGDB en panne sur ce lot : on n'ecrit rien, retente plus tard.
    }
    for (const data of fetched) {
      for (const gameId of igdbIdToGameIds.get(data.igdbId) ?? []) {
        await upsertEnrichedGame(
          gameId,
          data,
          timeToBeat.get(data.igdbId)?.normallyMinutes ?? null,
          data.hypes,
        );
        summary.enriched += 1;
      }
    }
    await deps.sleep(SLEEP_MS_BETWEEN_BATCHES);
  }

  return summary;
}

// Hydrate des jeux manquants dans le catalogue a partir d'igdbIds. Idempotent :
// ne traite que les igdbIds absents. Retourne le nombre de jeux inseres.
export async function hydrateGamesByIgdbIds(
  igdbIds: number[],
  clientId: string = process.env.TWITCH_CLIENT_ID ?? "",
  deps: IgdbDeps = defaultDeps(),
): Promise<number> {
  if (igdbIds.length === 0) return 0;

  // Deduplication : l'input peut contenir des doublons (ex. plusieurs jeux
  // owned qui pointent vers le meme igdbId). Set pour deduper une fois
  // au depart.
  const uniqueIds = [...new Set(igdbIds)];

  // Filtrer les igdbIds deja presents.
  const present = await db
    .select({ igdbId: games.igdbId })
    .from(games)
    .where(inArray(games.igdbId, uniqueIds));
  const have = new Set(present.map((p) => p.igdbId).filter((x): x is number => x != null));
  const missing = uniqueIds.filter((id) => !have.has(id));
  if (missing.length === 0) return 0;

  const token = await deps.getToken();
  let hydrated = 0;

  // Fetcher par lots + upsert pour chaque igdbId.
  for (const part of chunk(missing, BATCH)) {
    let fetched: IgdbGame[];
    let timeToBeat: Map<number, { normallyMinutes: number; count: number }>;
    try {
      fetched = await deps.fetchGamesByIds(part, token, clientId);
      timeToBeat = await deps.fetchTimeToBeats(part, token, clientId);
    } catch {
      // Echec du lot : skip et continuer au prochain.
      continue;
    }

    for (const data of fetched) {
      // Generer un slug deterministe + unique avec l'igdbId.
      const slug = `${slugify(data.name)}-igdb-${data.igdbId}`;
      const [newGame] = await db
        .insert(games)
        .values({
          igdbId: data.igdbId,
          title: data.name,
          slug,
          isCustom: false,
        })
        // Defense-in-depth : tolérer un conflit de slug (insert concurrent ou
        // igdbId deja present de maniere raciale). Si insert reussit, returning
        // donne [{ id }] ; si conflict, returning donne [] et newGame.id est
        // undefined. Ne pas appeler upsertEnrichedGame si insert a echoue.
        .onConflictDoNothing({ target: games.slug })
        .returning({ id: games.id });
      // Enregistrer l'enrichissement uniquement si l'insert a reussi.
      if (newGame) {
        await upsertEnrichedGame(
          newGame.id,
          data,
          timeToBeat.get(data.igdbId)?.normallyMinutes ?? null,
          data.hypes,
        );
        hydrated += 1;
      }
    }
    await deps.sleep(SLEEP_MS_BETWEEN_BATCHES);
  }

  return hydrated;
}

// Slugify helper, pour garantir la coherence avec steam.service.ts.
function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "game";
}

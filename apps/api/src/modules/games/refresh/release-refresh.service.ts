// Rafraichissement quotidien des jeux a venir : les dates de sortie annoncees
// bougent souvent (reports, precisions). On ne rafraichit que le sous-ensemble
// borne des jeux release_status='upcoming' du catalogue (independant du nombre
// d'users), par lots de 500 (limite d'une requete IGDB), et chaque changement
// de date/statut est trace dans game_updates (file des futures alertes).
// Un batch IGDB perdu ou un jeu dont l'update+trace echoue (ex. coupure
// transitoire de la BDD distante) sont comptes mais n'interrompent jamais le
// run : le reste du catalogue doit etre traite quoi qu'il arrive.
// Service pur et injecte : le scheduler (in-process aujourd'hui, worker demain)
// n'est qu'un point d'appel.
import { db, games, gameUpdates } from "@nextquest/db";
import { and, eq, isNotNull } from "drizzle-orm";
import { fetchGamesByIds } from "../igdb/igdb.client.js";
import { getTwitchToken } from "../igdb/igdb.auth.js";
import { redis } from "../../../lib/redis.js";

const BATCH = 500;
const SLEEP_MS_BETWEEN_BATCHES = 250;

export type RefreshSummary = {
  checked: number;
  updated: number;
  failedBatches: number;
  failedGames: number;
};

export type RefreshDeps = {
  getToken: () => Promise<string>;
  fetchGamesByIds: typeof fetchGamesByIds;
  sleep: (ms: number) => Promise<void>;
  clientId: string;
};

export function defaultRefreshDeps(): RefreshDeps {
  return {
    getToken: () => {
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
    fetchGamesByIds,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    clientId: process.env.TWITCH_CLIENT_ID ?? "",
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function refreshUpcomingReleases(
  deps: RefreshDeps = defaultRefreshDeps(),
): Promise<RefreshSummary> {
  const rows = await db
    .select({
      id: games.id,
      igdbId: games.igdbId,
      releaseDate: games.releaseDate,
      releaseDatePrecision: games.releaseDatePrecision,
      releaseStatus: games.releaseStatus,
      igdbHypes: games.igdbHypes,
    })
    .from(games)
    .where(and(eq(games.releaseStatus, "upcoming"), isNotNull(games.igdbId)));

  const byIgdbId = new Map(rows.map((r) => [r.igdbId!, r]));
  const summary: RefreshSummary = {
    checked: rows.length,
    updated: 0,
    failedBatches: 0,
    failedGames: 0,
  };
  if (rows.length === 0) return summary;

  const token = await deps.getToken();
  const today = new Date().toISOString().slice(0, 10);

  for (const ids of chunk([...byIgdbId.keys()], BATCH)) {
    let fetched;
    try {
      fetched = await deps.fetchGamesByIds(ids, token, deps.clientId);
    } catch {
      // Batch perdu : le run quotidien suivant rattrapera, inutile d'arreter les autres lots.
      summary.failedBatches += 1;
      continue;
    }

    for (const data of fetched) {
      const current = byIgdbId.get(data.igdbId);
      if (!current) continue;

      const nextStatus =
        data.releaseDate && data.releaseDate > today ? ("upcoming" as const) : ("released" as const);
      const dateChanged = data.releaseDate !== current.releaseDate;
      const precisionChanged = data.releaseDatePrecision !== current.releaseDatePrecision;
      const statusChanged = nextStatus !== current.releaseStatus;
      const hypesChanged = data.hypes !== current.igdbHypes;
      if (!dateChanged && !precisionChanged && !statusChanged && !hypesChanged) continue;

      try {
        await db.transaction(async (tx) => {
          await tx
            .update(games)
            .set({
              releaseDate: data.releaseDate,
              releaseDatePrecision: data.releaseDatePrecision,
              releaseStatus: nextStatus,
              igdbHypes: data.hypes,
              lastSyncedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(games.id, current.id));

          // Seuls date et statut interessent les alertes ; hypes/precision seuls ne tracent pas.
          if (dateChanged) {
            await tx.insert(gameUpdates).values({
              gameId: current.id,
              fieldChanged: "release_date",
              oldValue: current.releaseDate,
              newValue: data.releaseDate,
              source: "igdb",
            });
          }
          if (statusChanged) {
            await tx.insert(gameUpdates).values({
              gameId: current.id,
              fieldChanged: "release_status",
              oldValue: current.releaseStatus,
              newValue: nextStatus,
              source: "igdb",
            });
          }
        });
        summary.updated += 1;
      } catch {
        // Jeu isole : une coupure transitoire (BDD distante) ne doit pas stopper
        // les autres jeux du lot ; le run quotidien suivant retentera celui-ci.
        summary.failedGames += 1;
      }
    }

    await deps.sleep(SLEEP_MS_BETWEEN_BATCHES);
  }

  return summary;
}

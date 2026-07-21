// Re-enrichit les jeux du catalogue ayant un igdb_id mais des metadonnees
// incompletes (pas de genre lie, ou game_platforms vide, ou rating NULL).
// Sert a rattraper les jeux crees "creux" avant le fix de l'ajout manuel
// (fire-and-forget d'enrichGames desormais declenche a chaque ajout).
//
// hydrateGamesByIgdbIds ne convient pas ici : elle n'insere que des jeux
// ABSENTS du catalogue (elle ignore silencieusement les igdbIds deja
// presents). Notre cible est l'inverse - des jeux deja presents mais mal
// enrichis - donc on reprend directement upsertEnrichedGame, avec le meme
// motif de fetch par lots + pacing que enrichGames (respect du rate limit
// IGDB de 4 req/s via le sleep entre deux lots).
//
// Usage : pnpm --filter @nextquest/api exec tsx src/scripts/backfill-enrich.ts
import { config } from "dotenv";
config({ path: "../../.env" });

import { db, withDbRetry, games, gameGenres, gamePlatforms } from "@nextquest/db";
import { sql } from "drizzle-orm";
import { defaultDeps, upsertEnrichedGame } from "../modules/games/igdb/igdb.service.js";
import type { IgdbGame } from "../modules/games/igdb/igdb.client.js";

const BATCH = 500;
const SLEEP_MS_BETWEEN_BATCHES = 250;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const rows = await db
    .select({ id: games.id, igdbId: games.igdbId })
    .from(games)
    .where(
      sql`${games.igdbId} is not null and (
        ${games.igdbRating} is null
        or ${games.id} not in (select ${gameGenres.gameId} from ${gameGenres})
        or ${games.id} not in (select ${gamePlatforms.gameId} from ${gamePlatforms})
      )`,
    );

  console.log(`Backfill de ${rows.length} jeux creux...`);
  if (rows.length === 0) {
    console.log("Rien a faire.");
    process.exit(0);
  }

  // Un igdbId peut correspondre a plusieurs lignes games (rare mais possible
  // en cas de doublon historique) : on regroupe pour ne fetcher qu'une fois.
  const igdbIdToGameIds = new Map<number, string[]>();
  for (const r of rows) {
    if (r.igdbId == null) continue;
    const list = igdbIdToGameIds.get(r.igdbId) ?? [];
    list.push(r.id);
    igdbIdToGameIds.set(r.igdbId, list);
  }

  const deps = defaultDeps();
  const clientId = process.env.TWITCH_CLIENT_ID ?? "";
  const token = await deps.getToken();

  let enriched = 0;
  let failed = 0;
  for (const part of chunk([...igdbIdToGameIds.keys()], BATCH)) {
    // Nombre de jeux (pas d'igdbIds) couverts par ce lot, pour un comptage
    // failed/enriched exact meme si un igdbId correspond a plusieurs jeux.
    const gamesInPart = part.reduce((n, id) => n + (igdbIdToGameIds.get(id)?.length ?? 0), 0);

    let fetched: IgdbGame[];
    let timeToBeat: Map<number, { normallyMinutes: number; count: number }>;
    try {
      fetched = await deps.fetchGamesByIds(part, token, clientId);
      timeToBeat = await deps.fetchTimeToBeats(part, token, clientId);
    } catch (e) {
      // Lot entier perdu (IGDB indisponible) : aucun jeu de ce lot n'a ete traite.
      failed += gamesInPart;
      console.error(`Echec du lot IGDB (${gamesInPart} jeux) :`, e);
      await deps.sleep(SLEEP_MS_BETWEEN_BATCHES);
      continue;
    }

    for (const data of fetched) {
      for (const gameId of igdbIdToGameIds.get(data.igdbId) ?? []) {
        try {
          // withDbRetry : les upserts sur la BDD distante peuvent se faire
          // couper (CONNECTION_CLOSED), meme motif que enrichGames.
          await withDbRetry(() =>
            upsertEnrichedGame(
              gameId,
              data,
              timeToBeat.get(data.igdbId)?.normallyMinutes ?? null,
              data.hypes,
            ),
          );
          enriched += 1;
        } catch (e) {
          failed += 1;
          console.error(`Echec de l'upsert du jeu ${gameId} (igdbId ${data.igdbId}) :`, e);
        }
      }
    }
    await deps.sleep(SLEEP_MS_BETWEEN_BATCHES);
  }

  console.log(`Backfill termine : ${enriched} jeux enrichis, ${failed} echecs.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

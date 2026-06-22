import { hydrateGamesByIgdbIds } from "../games/igdb/igdb.service.js";

// Insere/enrichit dans `games` les igdbIds candidats absents du catalogue.
// Idempotent : on ne traite que les manquants.
export async function hydrateMissingGames(igdbIds: number[]): Promise<void> {
  if (igdbIds.length === 0) return;
  await hydrateGamesByIgdbIds(igdbIds);
}

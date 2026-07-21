import type { Candidate } from "./scoring.js";

// game_type IGDB a exclure de la decouverte : 1=DLC, 2=expansion liee,
// 3=bundle, 13=pack. On GARDE 0=main et 4=standalone_expansion (jouable seule).
const EXCLUDED_GAME_TYPES = new Set([1, 2, 3, 13]);

export function filterCandidates(candidates: Candidate[], ownedPlatformIds: Set<string>): Candidate[] {
  return candidates.filter((c) => {
    // DLC / expansion liee / bundle / pack / edition -> jamais recommande
    if (c.gameType != null && EXCLUDED_GAME_TYPES.has(c.gameType)) return false;
    if (c.versionParentIgdbId != null) return false;
    // Plateforme : exclure seulement si les plateformes du candidat sont
    // connues ET aucune n'est possedee (fail-open si inconnues -> backfill non passe).
    if (c.platformIds.length > 0 && !c.platformIds.some((p) => ownedPlatformIds.has(p))) {
      return false;
    }
    return true;
  });
}

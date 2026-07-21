// Suivi de progression de l'enrichissement IGDB, dans Redis. Sert au polling
// front (modale de progression pendant/apres un import). Best-effort : une
// panne Redis ne doit jamais faire echouer l'enrichissement lui-meme, donc
// chaque fonction avale ses erreurs.

import { randomUUID } from "node:crypto";
import { redis } from "../../../lib/redis.js";

export type EnrichProgress = {
  // Identifie le run courant : deux enrichissements peuvent se chevaucher pour
  // le meme user (import Steam + trigger manuel par ex.), ce runId permet a
  // markEnrichDone de ne cloturer que SON run, jamais un run plus recent.
  runId: string;
  status: "running" | "done";
  total: number;
  startedAt: number;
  // Jeux couverts par ce run precis : sert a scoper le comptage "done" a ce
  // batch (cf. import-status.service.ts), pas a tous les jeux du user.
  gameIds: string[];
};

// TTL genereux : couvre un import qui prendrait du temps sur un gros catalogue,
// sans laisser trainer indefiniment une cle orpheline si l'user ne repolle jamais.
const TTL_SECONDS = 600;

export function progressKey(userId: string): string {
  return `enrich:progress:${userId}`;
}

// Demarre le suivi d'un nouveau run et renvoie son id. L'appelant doit repasser
// ce runId a markEnrichDone pour cloturer precisement CE run (et pas un autre).
export async function markEnrichStart(
  userId: string,
  gameIds: string[],
): Promise<string> {
  const runId = randomUUID();
  try {
    const progress: EnrichProgress = {
      runId,
      status: "running",
      total: gameIds.length,
      startedAt: Date.now(),
      gameIds,
    };
    await redis.set(progressKey(userId), JSON.stringify(progress), "EX", TTL_SECONDS);
  } catch {
    // best-effort : le suivi de progression n'est qu'un confort UX
  }
  return runId;
}

// Cloture le run runId. Si un run plus recent a demarre entretemps (progress
// courant avec un autre runId), on ne touche a rien : un run perime qui finit
// en retard ne doit ni ecraser le total/gameIds du run en cours, ni le marquer
// "done" a tort.
export async function markEnrichDone(userId: string, runId: string): Promise<void> {
  try {
    const current = await readEnrichProgress(userId);
    if (!current || current.runId !== runId) return;
    const updated: EnrichProgress = { ...current, status: "done" };
    await redis.set(progressKey(userId), JSON.stringify(updated), "EX", TTL_SECONDS);
  } catch {
    // best-effort
  }
}

export async function readEnrichProgress(userId: string): Promise<EnrichProgress | null> {
  try {
    const raw = await redis.get(progressKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as EnrichProgress;
  } catch {
    return null;
  }
}

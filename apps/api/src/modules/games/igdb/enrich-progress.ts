// Suivi de progression de l'enrichissement IGDB, dans Redis. Sert au polling
// front (modale de progression pendant/apres un import). Best-effort : une
// panne Redis ne doit jamais faire echouer l'enrichissement lui-meme, donc
// chaque fonction avale ses erreurs.

import { redis } from "../../../lib/redis.js";

export type EnrichProgress = {
  status: "running" | "done";
  total: number;
  startedAt: number;
};

// TTL genereux : couvre un import qui prendrait du temps sur un gros catalogue,
// sans laisser trainer indefiniment une cle orpheline si l'user ne repolle jamais.
const TTL_SECONDS = 600;

export function progressKey(userId: string): string {
  return `enrich:progress:${userId}`;
}

export async function markEnrichStart(userId: string, total: number): Promise<void> {
  try {
    const progress: EnrichProgress = {
      status: "running",
      total,
      startedAt: Date.now(),
    };
    await redis.set(progressKey(userId), JSON.stringify(progress), "EX", TTL_SECONDS);
  } catch {
    // best-effort : le suivi de progression n'est qu'un confort UX
  }
}

export async function markEnrichDone(userId: string): Promise<void> {
  try {
    const current = await readEnrichProgress(userId);
    if (!current) return;
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

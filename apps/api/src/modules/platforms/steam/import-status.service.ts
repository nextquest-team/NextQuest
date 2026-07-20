// DTO de statut d'import, poll par le front pour la modale de progression
// pendant/apres un import Steam (enrichissement IGDB des jaquettes en tache
// de fond). S'appuie sur enrich-progress.ts (Redis, best-effort) pour savoir
// si un enrichissement est en cours, et sur la BDD pour le detail par jeu.

import { db, games, userGames } from "@nextquest/db";
import { eq } from "drizzle-orm";
import { readEnrichProgress } from "../../games/igdb/enrich-progress.js";

export type ImportStatusDTO = {
  status: "running" | "done" | "idle";
  total: number;
  done: number;
  games: { id: string; coverUrl: string | null; isEnriched: boolean }[];
};

export async function getImportStatus(userId: string): Promise<ImportStatusDTO> {
  const progress = await readEnrichProgress(userId);
  if (!progress) {
    return { status: "idle", total: 0, done: 0, games: [] };
  }

  const rows = await db
    .select({
      id: games.id,
      coverUrl: games.coverUrl,
      igdbId: games.igdbId,
      lastSyncedAt: games.lastSyncedAt,
    })
    .from(games)
    .innerJoin(userGames, eq(userGames.gameId, games.id))
    .where(eq(userGames.userId, userId));

  const startedAt = new Date(progress.startedAt);
  const done = rows.filter(
    (r) => r.lastSyncedAt !== null && r.lastSyncedAt >= startedAt,
  ).length;

  return {
    status: progress.status,
    total: progress.total,
    done,
    games: rows.map((r) => ({
      id: r.id,
      coverUrl: r.coverUrl,
      isEnriched: r.igdbId !== null,
    })),
  };
}

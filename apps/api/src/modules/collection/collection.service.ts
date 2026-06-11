import { db, userGames, userGameStatusHistory } from "@nextquest/db";
import { and, eq, sql } from "drizzle-orm";
import type { GameStatus } from "./collection.schemas.js";
import {
  toUserGameStatusDTO,
  type UserGameStatusDTO,
} from "./collection.dto.js";

// Champs de statut selectionnes / retournes, factorises pour rester coherents
// entre la lecture, le RETURNING et le DTO.
const STATUS_FIELDS = {
  id: userGames.id,
  status: userGames.status,
  startedAt: userGames.startedAt,
  completedAt: userGames.completedAt,
  updatedAt: userGames.updatedAt,
} as const;

// Change le statut d'un jeu de la collection de l'user.
// Renvoie null si le user_game n'existe pas ou n'appartient pas a l'user
// (la route en deduit un 404, sans distinguer les deux cas).
export async function updateGameStatus(
  userId: string,
  userGameId: string,
  newStatus: GameStatus,
): Promise<UserGameStatusDTO | null> {
  const [current] = await db
    .select(STATUS_FIELDS)
    .from(userGames)
    .where(and(eq(userGames.id, userGameId), eq(userGames.userId, userId)))
    .limit(1);

  if (!current) return null;

  // No-op : meme statut -> aucune ecriture, aucune ligne d'historique.
  if (current.status === newStatus) {
    return toUserGameStatusDTO(current);
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(userGames)
      .set({
        status: newStatus,
        updatedAt: new Date(),
        // started_at / completed_at : poses a la 1re transition seulement,
        // jamais reecrits ni vides ensuite (trace honnete pour les stats).
        ...(newStatus === "playing" && current.startedAt === null
          ? { startedAt: sql`current_date` }
          : {}),
        ...(newStatus === "completed" && current.completedAt === null
          ? { completedAt: sql`current_date` }
          : {}),
      })
      .where(eq(userGames.id, userGameId))
      .returning(STATUS_FIELDS);

    await tx.insert(userGameStatusHistory).values({
      userGameId,
      oldStatus: current.status,
      newStatus,
    });

    return toUserGameStatusDTO(updated);
  });
}

import type { userGames } from "@nextquest/db";
import type { InferSelectModel } from "drizzle-orm";
import type { GameStatus } from "./collection.schemas.js";

type UserGameRow = InferSelectModel<typeof userGames>;

// DTO renvoye au client apres un changement de statut.
export type UserGameStatusDTO = {
  id: string;
  status: GameStatus;
  startedAt: string | null; // date YYYY-MM-DD (colonne `date`)
  completedAt: string | null; // date YYYY-MM-DD
  updatedAt: string | null; // ISO 8601
};

// Mappe les champs de statut d'une row user_games vers le DTO.
// `status` est caste : la colonne BDD inclut `wishlist`, mais les flux qui
// produisent ces rows (import Steam, cette route) ne posent jamais wishlist.
export function toUserGameStatusDTO(
  row: Pick<
    UserGameRow,
    "id" | "status" | "startedAt" | "completedAt" | "updatedAt"
  >,
): UserGameStatusDTO {
  return {
    id: row.id,
    status: row.status as GameStatus,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

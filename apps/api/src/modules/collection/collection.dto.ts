import type { userGames } from "@nextquest/db";
import type { InferSelectModel } from "drizzle-orm";
import { GAME_STATUSES, type GameStatus } from "./collection.schemas.js";

type UserGameRow = InferSelectModel<typeof userGames>;

// DTO renvoye au client apres un changement de statut.
export type UserGameStatusDTO = {
  id: string;
  status: GameStatus;
  startedAt: string | null; // date YYYY-MM-DD (colonne `date`)
  completedAt: string | null; // date YYYY-MM-DD
  updatedAt: string | null; // ISO 8601
};

// Garde-fou : la colonne BDD inclut `wishlist` (game_status_enum), exclu de
// GameStatus au MVP. Les flux qui produisent ces rows (import Steam, route de
// statut) ne posent jamais wishlist ; si la valeur sort de l'ensemble MVP c'est
// une violation de contrat, on casse proprement plutot que de laisser fuiter un
// statut non attendu vers le client.
function assertMvpStatus(status: string): GameStatus {
  if (!(GAME_STATUSES as readonly string[]).includes(status)) {
    throw new Error(`Statut hors MVP inattendu en base: ${status}`);
  }
  return status as GameStatus;
}

// Mappe les champs de statut d'une row user_games vers le DTO.
export function toUserGameStatusDTO(
  row: Pick<
    UserGameRow,
    "id" | "status" | "startedAt" | "completedAt" | "updatedAt"
  >,
): UserGameStatusDTO {
  return {
    id: row.id,
    status: assertMvpStatus(row.status),
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

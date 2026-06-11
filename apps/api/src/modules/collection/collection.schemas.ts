import { z } from "zod";

// Statuts pilotables par l'utilisateur au MVP. `wishlist` (5e valeur de l'enum
// BDD game_status_enum) est volontairement exclu : il releve du flux d'ajout
// manuel de jeu, hors MVP.
export const GAME_STATUSES = [
  "backlog",
  "playing",
  "completed",
  "abandoned",
] as const;

export type GameStatus = (typeof GAME_STATUSES)[number];

export const updateGameStatusSchema = z.object({
  status: z.enum(GAME_STATUSES),
});

export type UpdateGameStatusInput = z.infer<typeof updateGameStatusSchema>;

// L'id de user_game vient de l'URL : on le valide en uuid pour renvoyer un 400
// propre (et non un 500 Postgres "invalid input syntax for type uuid") sur un
// id malforme.
export const userGameParamsSchema = z.object({
  userGameId: z.string().uuid(),
});

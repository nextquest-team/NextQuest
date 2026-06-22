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

// Query de listing de la collection. limit/offset arrivent en string dans l'URL,
// d'ou le coerce. includeHidden : on parse explicitement la chaine plutot que
// z.coerce.boolean(), qui est piegeux (toute string non vide est truthy, donc
// "false" donnerait true).
export const listCollectionQuerySchema = z.object({
  status: z.enum(GAME_STATUSES).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  includeHidden: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type ListCollectionQuery = z.infer<typeof listCollectionQuerySchema>;

// Edition des champs hors statut (le statut garde sa route dediee + historique).
// Au moins un champ doit etre fourni. null = effacer la valeur, undefined = ne pas
// toucher au champ.
export const updateUserGameSchema = z
  .object({
    rating: z.number().int().min(1).max(10).nullable().optional(),
    review: z.string().max(2000).nullable().optional(),
    playtimeMinutes: z.number().int().min(0).optional(),
    isHidden: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "Au moins un champ a modifier est requis",
  });

export type UpdateUserGameInput = z.infer<typeof updateUserGameSchema>;

// Ajout d'un jeu EXISTANT du catalogue a la collection (la creation d'un jeu
// custom from scratch est un lot dedie ulterieur).
export const addGameSchema = z.object({
  gameId: z.string().uuid(),
  platformId: z.string().uuid().optional(),
});

export type AddGameInput = z.infer<typeof addGameSchema>;

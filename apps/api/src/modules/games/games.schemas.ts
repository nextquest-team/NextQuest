import { z } from "zod";

// Recherche catalogue. search >= 2 caracteres pour eviter de balayer toute la
// table. limit/offset arrivent en string dans l'URL, d'ou le coerce.
export const searchGamesQuerySchema = z.object({
  search: z.string().min(2).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type SearchGamesQuery = z.infer<typeof searchGamesQuerySchema>;

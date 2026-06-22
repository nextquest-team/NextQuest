import { z } from "zod";

// Feed "a venir". limit/offset arrivent en string dans l'URL (coerce). Tri par
// hype (anticipation) par defaut ; "date" pour une timeline chronologique.
export const upcomingQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(["hype", "date"]).default("hype"),
});

// Detail d'un jeu par IGDB id (entier positif, coerce depuis le path).
export const gameDetailParamsSchema = z.object({
  igdbId: z.coerce.number().int().positive(),
});

export type UpcomingQueryInput = z.infer<typeof upcomingQuerySchema>;
export type GameDetailParams = z.infer<typeof gameDetailParamsSchema>;

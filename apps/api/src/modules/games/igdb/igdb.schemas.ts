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

// Recherche live par nom (ajout manuel cote front). q obligatoire (1-100 caracteres),
// limit borne a 25 pour rester une liste d'autocomplete, pas un feed paginé.
// Defaut 18 : le service sur-fetch un pool de 50 candidats IGDB puis filtre/reclasse
// avant de couper a `limit`, donc ce defaut n'est que la taille de la liste finale.
export const searchIgdbQuerySchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(25).default(18),
});

export type UpcomingQueryInput = z.infer<typeof upcomingQuerySchema>;
export type GameDetailParams = z.infer<typeof gameDetailParamsSchema>;
export type SearchIgdbQueryInput = z.infer<typeof searchIgdbQuerySchema>;

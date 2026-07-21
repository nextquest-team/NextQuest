import { z } from "zod";
import { gameSummaryDTOSchema } from "./games.dto.js";

// Recherche catalogue. search >= 2 caracteres pour eviter de balayer toute la
// table. limit/offset arrivent en string dans l'URL, d'ou le coerce.
export const searchGamesQuerySchema = z.object({
  search: z.string().min(2).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type SearchGamesQuery = z.infer<typeof searchGamesQuerySchema>;

// --- Schemas de reponse ---

// GET /games : resultats de recherche catalogue, paginee.
export const gameSearchResultsSchema = z
  .object({
    items: z.array(gameSummaryDTOSchema).describe("Jeux trouves"),
    total: z.number().int().describe("Nombre total de resultats (hors pagination)"),
    limit: z.number().int().describe("Taille de page demandee"),
    offset: z.number().int().describe("Decalage de pagination demande"),
  })
  .describe("Resultats de recherche catalogue, paginee");

export type GameSearchResults = z.infer<typeof gameSearchResultsSchema>;

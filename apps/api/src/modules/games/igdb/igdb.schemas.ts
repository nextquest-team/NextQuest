import { z } from "zod";
import { upcomingGameDTOSchema, igdbSearchResultSchema } from "./igdb.dto.js";

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

// --- Schemas de reponse ---

// GET /games/upcoming : feed "a venir", paginee par limit/offset (pas de total :
// IGDB ne renvoie pas de compte exact sur ce type de requete).
export const upcomingGamesResultsSchema = z
  .object({
    items: z.array(upcomingGameDTOSchema).describe("Jeux a venir"),
    limit: z.number().int().describe("Taille de page demandee"),
    offset: z.number().int().describe("Decalage de pagination demande"),
  })
  .describe("Feed des jeux a venir, paginee");

export type UpcomingGamesResults = z.infer<typeof upcomingGamesResultsSchema>;

// GET /games/igdb/search : liste plate, pas de pagination (autocomplete borne a `limit`).
export const igdbSearchResultsSchema = z
  .object({
    items: z.array(igdbSearchResultSchema).describe("Resultats de recherche IGDB"),
  })
  .describe("Resultats de recherche IGDB par nom");

export type IgdbSearchResults = z.infer<typeof igdbSearchResultsSchema>;

// POST /users/me/library/enrich, POST /admin/games/enrich : bilan de la passe
// d'enrichissement (cf. EnrichSummary dans igdb.service.ts).
export const enrichSummarySchema = z
  .object({
    scanned: z.number().int().describe("Nombre de jeux candidats a l'enrichissement"),
    mapped: z.number().int().describe("Nombre de jeux resolus vers un igdbId"),
    enriched: z.number().int().describe("Nombre de jeux effectivement enrichis"),
    notFound: z.number().int().describe("Nombre de jeux introuvables sur IGDB"),
    failed: z.number().int().describe("Nombre de jeux dont le lot IGDB a echoue (a retenter)"),
  })
  .describe("Bilan d'une passe d'enrichissement IGDB");

export type EnrichSummaryDTO = z.infer<typeof enrichSummarySchema>;

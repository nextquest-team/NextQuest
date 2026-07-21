import { z } from "zod";

// Resume d'un jeu du catalogue, renvoye par la recherche (ajout manuel). SOURCE
// UNIQUE DE VERITE : le type GameSummaryDTO est infere du schema Zod, qui
// documente + serialise la reponse OpenAPI (serializer Zod actif globalement).
export const gameSummaryDTOSchema = z
  .object({
    id: z.uuid().describe("Identifiant du jeu"),
    title: z.string().describe("Titre du jeu"),
    slug: z.string().describe("Slug unique du jeu"),
    coverUrl: z.string().nullable().describe("URL de la jaquette"),
    releaseDate: z.string().nullable().describe("Date de sortie (YYYY-MM-DD)"),
    isEnriched: z.boolean().describe("Jeu enrichi via IGDB (igdb_id renseigne)"),
  })
  .describe("Resume d'un jeu du catalogue");

export type GameSummaryDTO = z.infer<typeof gameSummaryDTOSchema>;

// Schema de reponse du referentiel genres (documentation + serialisation OpenAPI).
import { z } from "zod";

export const genreRefSchema = z
  .object({
    id: z.uuid().describe("Identifiant du genre"),
    igdbId: z.number().int().nullable().describe("Identifiant IGDB (null = genre custom)"),
    name: z.string().describe("Nom du genre (ex: Role-playing (RPG))"),
    slug: z.string().describe("Slug IGDB du genre (ex: role-playing-rpg)"),
  })
  .describe("Genre du referentiel");

export const genresListSchema = z
  .object({
    items: z.array(genreRefSchema).describe("Liste des genres"),
  })
  .describe("Liste des genres du referentiel, triee par nom");

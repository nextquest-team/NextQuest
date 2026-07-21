// Schema de reponse du referentiel plateformes (documentation + serialisation OpenAPI).
import { z } from "zod";

// Une plateforme du referentiel (PS5, Switch, PC...). igdbId n'est pas expose
// car listPlatforms() ne le selectionne pas (usage interne uniquement, voir
// packages/db/src/schema/services.ts).
export const platformRefSchema = z
  .object({
    id: z.uuid().describe("Identifiant de la plateforme"),
    name: z.string().describe("Nom de la plateforme (ex: PlayStation 5)"),
    code: z.string().describe("Code unique de la plateforme (ex: ps5)"),
    iconUrl: z.string().nullable().describe("URL de l'icone de la plateforme"),
  })
  .describe("Plateforme du referentiel");

export const platformsListSchema = z
  .object({
    items: z.array(platformRefSchema).describe("Liste des plateformes"),
  })
  .describe("Liste des plateformes du referentiel, triee par nom");

import { z } from "zod";

// Schemas de reponse Zod du module Steam. Pas de .dto.ts ici (les DTOs sont de
// simples objets litteraux construits dans les handlers), donc ce fichier
// centralise les schemas de reponse pour l'OpenAPI + la serialisation.

// GET /platforms/steam/link : URL de redirection OpenID vers laquelle le front
// doit rediriger l'utilisateur (Fastify ne redirige pas lui-meme ici, il ne
// fait que fournir l'URL).
export const steamLinkSchema = z
  .object({
    url: z.string().describe("URL OpenID Steam vers laquelle rediriger l'utilisateur"),
  })
  .describe("URL de demarrage du linking Steam");

// GET /platforms/steam : statut de la connexion Steam de l'utilisateur.
export const steamStatusSchema = z
  .object({
    connected: z.boolean().describe("Un compte Steam est-il lie"),
    steamId: z.string().nullable().describe("Identifiant Steam (SteamID64), null si non lie"),
    personaName: z.string().nullable().describe("Pseudo Steam public, null si non lie"),
  })
  .describe("Statut de la connexion Steam");

// DELETE /platforms/steam : resultat de la deliaison.
export const steamUnlinkResultSchema = z
  .object({
    unlinked: z.boolean().describe("true si un lien existait et a ete supprime"),
  })
  .describe("Resultat de la deliaison Steam");

// POST /platforms/steam/import : resultat de l'import. `warning` n'est present
// que lorsque la bibliotheque recuperee est vide (profil Steam prive).
export const steamImportResultSchema = z
  .object({
    imported: z.number().int().describe("Nombre de jeux importes"),
    warning: z
      .string()
      .optional()
      .describe("Message d'avertissement (ex: bibliotheque Steam vide/privee)"),
  })
  .describe("Resultat de l'import de la bibliotheque Steam");

// GET /platforms/steam/import/status : progression de l'enrichissement IGDB
// poste-import, pollee par le front pour la modale de progression.
export const steamImportStatusSchema = z
  .object({
    status: z
      .enum(["running", "done", "idle"])
      .describe("Etat de l'enrichissement en cours"),
    total: z.number().int().describe("Nombre total de jeux a enrichir"),
    done: z.number().int().describe("Nombre de jeux deja enrichis"),
    games: z
      .array(
        z.object({
          id: z.uuid().describe("Identifiant du jeu"),
          coverUrl: z.string().nullable().describe("URL de la jaquette, null si pas encore recuperee"),
          isEnriched: z.boolean().describe("Le jeu a-t-il ete enrichi via IGDB"),
        }),
      )
      .describe("Detail par jeu de la bibliotheque importee"),
  })
  .describe("Progression de l'enrichissement de la bibliotheque Steam");

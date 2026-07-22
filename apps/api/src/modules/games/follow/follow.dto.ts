import { z } from "zod";

export const followedGameDTOSchema = z
  .object({
    igdbId: z.number().int().describe("Identifiant IGDB du jeu"),
    title: z.string().describe("Titre du jeu"),
    releaseDate: z.string().nullable().describe("Date de sortie (YYYY-MM-DD)"),
    releaseDatePrecision: z
      .enum(["day", "month", "quarter", "year", "tbd"])
      .nullable()
      .describe("Precision de la date annoncee"),
    coverUrl: z.string().nullable().describe("URL de la jaquette"),
    hypes: z.number().int().nullable().describe("Nombre d'anticipations IGDB"),
    genres: z
      .array(
        z.object({
          igdbId: z.number().int(),
          name: z.string(),
          slug: z.string(),
        }),
      )
      .describe("Genres du jeu (referentiel local, genres custom exclus)"),
    platforms: z
      .array(
        z.object({
          igdbId: z.number().int(),
          name: z.string(),
          // Le referentiel local n'a pas d'abreviation IGDB : null, le front retombe sur name.
          abbreviation: z.string().nullable(),
        }),
      )
      .describe("Plateformes du jeu (referentiel local)"),
  })
  .describe("Jeu suivi (etoile timeline), meme forme que le feed upcoming");

export const followedGamesListSchema = z
  .object({ items: z.array(followedGameDTOSchema) })
  .describe("Jeux suivis de l'utilisateur, tries par date de sortie croissante");

export const followParamsSchema = z.object({
  igdbId: z.coerce.number().int().positive(),
});

export type FollowedGameDTO = z.infer<typeof followedGameDTOSchema>;

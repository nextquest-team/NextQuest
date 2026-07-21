import { z } from "zod";
import { RECO_BUCKETS, recommendationDTOSchema } from "./recommendations.dto.js";

// Re-exporte pour les modules qui importent RECO_BUCKETS depuis schemas.js
// (le tableau vit dans dto.ts, voir le commentaire la-bas).
export { RECO_BUCKETS };

export const listRecoQuerySchema = z.object({
  bucket: z.enum(RECO_BUCKETS).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListRecoQuery = z.infer<typeof listRecoQuerySchema>;

export const recoParamsSchema = z.object({ id: z.uuid() });

export const feedbackBodySchema = z.object({
  action: z.enum(["liked", "dismissed", "added"]),
});

export type FeedbackBody = z.infer<typeof feedbackBodySchema>;

// Refresh : ids des recos actuellement affichees que l'user veut passer.
// Tableau vide tolere (refresh "a blanc" = simple relecture du set courant).
// Borne a 20 pour eviter un payload abusif (le front en affiche 3 max).
export const refreshBodySchema = z.object({
  skip: z.array(z.uuid()).max(20).default([]),
});

export type RefreshBody = z.infer<typeof refreshBodySchema>;

// Refresh renvoie un set groupe (comme GET /recommendations sans bucket) : seul
// limit est pertinent (nb de recos par bucket), pas de pagination par offset.
export const refreshQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// --- Schemas de reponse ---

// Reponse groupee (GET /recommendations sans bucket, POST /refresh) : 3 buckets,
// limit recos chacun.
export const groupedRecommendationsSchema = z
  .object({
    libraryUnplayed: z.array(recommendationDTOSchema).describe("Recos jeux possedes jamais lances"),
    discovery: z.array(recommendationDTOSchema).describe("Recos decouverte"),
    upcoming: z.array(recommendationDTOSchema).describe("Recos sorties a venir"),
  })
  .describe("Recommandations groupees par bucket");

export type GroupedRecommendations = z.infer<typeof groupedRecommendationsSchema>;

// Reponse paginee (GET /recommendations avec bucket precis).
export const paginatedRecommendationsSchema = z
  .object({
    items: z.array(recommendationDTOSchema).describe("Recommandations de la page"),
    total: z.number().int().describe("Nombre total de recommandations du bucket"),
    limit: z.number().int().describe("Taille de page demandee"),
    offset: z.number().int().describe("Decalage de pagination demande"),
  })
  .describe("Recommandations paginees d'un bucket");

export type PaginatedRecommendations = z.infer<typeof paginatedRecommendationsSchema>;

// GET /recommendations renvoie l'une ou l'autre forme selon la presence de `bucket`.
export const listRecommendationsResponseSchema = z.union([
  groupedRecommendationsSchema,
  paginatedRecommendationsSchema,
]);

// POST /recommendations/generate : nombre de recos (re)generees.
export const generateResultSchema = z
  .object({
    inserted: z.number().int().describe("Nombre de recommandations inserees"),
  })
  .describe("Resultat de la (re)generation des recommandations");

// POST /recommendations/:id/feedback : accuse de reception simple.
export const feedbackResultSchema = z
  .object({
    ok: z.literal(true).describe("Feedback enregistre"),
  })
  .describe("Resultat de l'enregistrement du feedback");

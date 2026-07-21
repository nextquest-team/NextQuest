import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  listRecoQuerySchema,
  recoParamsSchema,
  feedbackBodySchema,
  refreshBodySchema,
  refreshQuerySchema,
  listRecommendationsResponseSchema,
  groupedRecommendationsSchema,
  generateResultSchema,
  feedbackResultSchema,
} from "./recommendations.schemas.js";
import {
  listRecommendations,
  getGroupedRecommendations,
  recordFeedback,
  refreshRecommendations,
} from "./recommendations.service.js";
import { generateRecommendations } from "./generate.js";
import { requireAuth, userIdOf } from "../../lib/guards.js";
import { errorResponses } from "../../lib/openapi.js";

export async function recommendationsRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    "/recommendations",
    {
      onRequest: [requireAuth],
      schema: {
        tags: ["Recommendations"],
        operationId: "listRecommendations",
        summary: "Lister les recommandations (groupe ou paginee par bucket)",
        description:
          "Sans `bucket` : renvoie les recos groupees par bucket (library_unplayed, discovery, upcoming), limit par bucket. Avec `bucket` : renvoie une page paginee (items, total) de ce bucket.",
        security: [{ bearerAuth: [] }],
        querystring: listRecoQuerySchema,
        response: {
          200: listRecommendationsResponseSchema,
          ...errorResponses(400, 401),
        },
      },
    },
    async (request) => {
      const userId = userIdOf(request);
      const { bucket, limit, offset } = request.query;

      // Si pas de bucket: reponse groupee (3 buckets, limit chacun)
      if (!bucket) {
        return getGroupedRecommendations(userId, limit);
      }

      // Si bucket specifie: reponse paginee
      const { items, total } = await listRecommendations({
        userId,
        bucket,
        limit,
        offset,
      });

      return { items, total, limit, offset };
    },
  );

  r.post(
    "/recommendations/generate",
    {
      onRequest: [requireAuth],
      schema: {
        tags: ["Recommendations"],
        operationId: "generateRecommendations",
        summary: "(Re)calculer les recommandations de l'utilisateur",
        description:
          "Recalcule entierement le profil de gout et remplace les recommandations non actionnees (celles avec feedback sont conservees pour l'apprentissage).",
        security: [{ bearerAuth: [] }],
        response: {
          200: generateResultSchema,
          ...errorResponses(401),
        },
      },
    },
    async (request) => {
      return generateRecommendations(userIdOf(request), request.log);
    },
  );

  // Refresh : passe les jeux affiches (1 ou plusieurs) et renvoie les suivants.
  // Rotation, pas de regeneration : les jeux passes reviendront apres le tour du pool.
  r.post(
    "/recommendations/refresh",
    {
      onRequest: [requireAuth],
      schema: {
        tags: ["Recommendations"],
        operationId: "refreshRecommendations",
        summary: "Passer les jeux affiches et recuperer les suivants (rotation)",
        description:
          "Marque les recos passees en argument comme passees (rotation, pas de decision definitive), puis renvoie le set groupe a jour par bucket.",
        security: [{ bearerAuth: [] }],
        body: refreshBodySchema,
        querystring: refreshQuerySchema,
        response: {
          200: groupedRecommendationsSchema,
          ...errorResponses(400, 401),
        },
      },
    },
    async (request) => {
      return refreshRecommendations(
        userIdOf(request),
        request.body.skip,
        request.query.limit,
      );
    },
  );

  r.post(
    "/recommendations/:id/feedback",
    {
      onRequest: [requireAuth],
      schema: {
        tags: ["Recommendations"],
        operationId: "submitRecommendationFeedback",
        summary: "Enregistrer un swipe (like / dismiss / add)",
        description:
          "Enregistre la decision de l'utilisateur sur une recommandation. Le feedback exclut definitivement la reco de la liste et alimente le profil de gout.",
        security: [{ bearerAuth: [] }],
        params: recoParamsSchema,
        body: feedbackBodySchema,
        response: {
          200: feedbackResultSchema,
          ...errorResponses(400, 401, 404),
        },
      },
    },
    async (request, reply) => {
      const ok = await recordFeedback(userIdOf(request), request.params.id, request.body.action);
      if (!ok) return reply.code(404).send({ error: "Recommandation introuvable" });
      return { ok: true as const };
    },
  );
}

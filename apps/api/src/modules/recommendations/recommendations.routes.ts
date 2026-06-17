import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { listRecoQuerySchema, recoParamsSchema, feedbackBodySchema } from "./recommendations.schemas.js";
import {
  listRecommendations,
  getGroupedRecommendations,
  recordFeedback,
} from "./recommendations.service.js";
import { requireAuth, userIdOf } from "../../lib/guards.js";

export async function recommendationsRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    "/recommendations",
    {
      onRequest: [requireAuth],
      schema: {
        tags: ["Recommendations"],
        summary: "Lister les recommandations (groupe ou paginee par bucket)",
        security: [{ bearerAuth: [] }],
        querystring: listRecoQuerySchema,
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
    "/recommendations/:id/feedback",
    {
      onRequest: [requireAuth],
      schema: {
        tags: ["Recommendations"],
        summary: "Enregistrer un swipe (like / dismiss / add)",
        security: [{ bearerAuth: [] }],
        params: recoParamsSchema,
        body: feedbackBodySchema,
      },
    },
    async (request, reply) => {
      const ok = await recordFeedback(userIdOf(request), request.params.id, request.body.action);
      if (!ok) return reply.code(404).send({ error: "Recommandation introuvable" });
      return { ok: true };
    },
  );
}

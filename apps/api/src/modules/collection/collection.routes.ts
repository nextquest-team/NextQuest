import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  updateGameStatusSchema,
  userGameParamsSchema,
} from "./collection.schemas.js";
import { updateGameStatus } from "./collection.service.js";
import { requireAuth, userIdOf } from "../../lib/guards.js";

export async function collectionRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.patch(
    "/collection/:userGameId/status",
    {
      onRequest: [requireAuth],
      schema: {
        tags: ["Collection"],
        summary: "Changer le statut d'un jeu de la collection",
        security: [{ bearerAuth: [] }],
        params: userGameParamsSchema,
        body: updateGameStatusSchema,
      },
    },
    async (request, reply) => {
      const userId = userIdOf(request);
      const { userGameId } = request.params;
      const { status } = request.body;

      const result = await updateGameStatus(userId, userGameId, status);
      if (!result) {
        return reply
          .code(404)
          .send({ error: "Jeu introuvable dans ta collection" });
      }
      return result;
    },
  );
}

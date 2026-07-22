import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireAuth, userIdOf } from "../../../lib/guards.js";
import { errorResponses, noContentSchema } from "../../../lib/openapi.js";
import { followGame, unfollowGame, listFollowedGames } from "./follow.service.js";
import { followedGameDTOSchema, followedGamesListSchema, followParamsSchema } from "./follow.dto.js";

export async function followRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    "/games/:igdbId/follow",
    {
      onRequest: [requireAuth],
      preHandler: app.rateLimit({ max: 60, timeWindow: "1 minute" }),
      schema: {
        tags: ["Games"],
        operationId: "followGame",
        summary: "Suivre la sortie d'un jeu (etoile timeline)",
        description:
          "Hydrate le jeu IGDB dans le catalogue si besoin puis enregistre le suivi. Idempotent.",
        security: [{ bearerAuth: [] }],
        params: followParamsSchema,
        response: {
          201: followedGameDTOSchema,
          ...errorResponses(400, 401, 404, 502),
        },
      },
    },
    async (request, reply) => {
      const { igdbId } = request.params;
      try {
        const dto = await followGame(userIdOf(request), igdbId);
        if (!dto) return reply.code(404).send({ error: "Jeu introuvable chez IGDB" });
        return reply.code(201).send(dto);
      } catch (err) {
        request.log.error({ err }, "IGDB indisponible pendant l'hydratation du follow");
        return reply.code(502).send({ error: "Service IGDB indisponible" });
      }
    },
  );

  r.delete(
    "/games/:igdbId/follow",
    {
      onRequest: [requireAuth],
      schema: {
        tags: ["Games"],
        operationId: "unfollowGame",
        summary: "Ne plus suivre la sortie d'un jeu",
        description: "Idempotent : 204 meme si le suivi n'existait pas.",
        security: [{ bearerAuth: [] }],
        params: followParamsSchema,
        response: {
          204: noContentSchema,
          ...errorResponses(400, 401),
        },
      },
    },
    async (request, reply) => {
      await unfollowGame(userIdOf(request), request.params.igdbId);
      return reply.code(204).send(null);
    },
  );

  r.get(
    "/games/followed",
    {
      onRequest: [requireAuth],
      schema: {
        tags: ["Games"],
        operationId: "listFollowedGames",
        summary: "Lister les jeux dont l'utilisateur suit la sortie",
        security: [{ bearerAuth: [] }],
        response: {
          200: followedGamesListSchema,
          ...errorResponses(401),
        },
      },
    },
    async (request) => {
      const items = await listFollowedGames(userIdOf(request));
      return { items };
    },
  );
}

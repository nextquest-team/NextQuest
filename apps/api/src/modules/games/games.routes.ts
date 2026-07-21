import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { searchGamesQuerySchema, gameSearchResultsSchema } from "./games.schemas.js";
import { searchGames } from "./games.service.js";
import { requireAuth, userIdOf } from "../../lib/guards.js";
import { errorResponses } from "../../lib/openapi.js";

export async function gamesRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // Recherche dans le catalogue (pour l'ajout manuel d'un jeu a la collection).
  r.get(
    "/games",
    {
      onRequest: [requireAuth],
      schema: {
        tags: ["Games"],
        operationId: "searchGames",
        summary: "Rechercher des jeux dans le catalogue",
        description:
          "Recherche par titre dans le catalogue partage, plus les jeux custom prives du user lui-meme. Utilise pour l'ajout manuel a la collection.",
        security: [{ bearerAuth: [] }],
        querystring: searchGamesQuerySchema,
        response: {
          200: gameSearchResultsSchema,
          ...errorResponses(400, 401),
        },
      },
    },
    async (request) => {
      const userId = userIdOf(request);
      const { search, limit, offset } = request.query;
      const { items, total } = await searchGames({ userId, search, limit, offset });
      return { items, total, limit, offset };
    },
  );
}

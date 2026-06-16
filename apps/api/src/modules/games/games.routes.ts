import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { searchGamesQuerySchema } from "./games.schemas.js";
import { searchGames } from "./games.service.js";
import { requireAuth, userIdOf } from "../../lib/guards.js";

export async function gamesRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // Recherche dans le catalogue (pour l'ajout manuel d'un jeu a la collection).
  r.get(
    "/games",
    {
      onRequest: [requireAuth],
      schema: {
        tags: ["Games"],
        summary: "Rechercher des jeux dans le catalogue",
        security: [{ bearerAuth: [] }],
        querystring: searchGamesQuerySchema,
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

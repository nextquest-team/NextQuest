import type { FastifyInstance } from "fastify";
import { requireAuth, requireAdmin, userIdOf } from "../../../lib/guards.js";
import { enrichGames } from "./igdb.service.js";

export async function igdbRoutes(app: FastifyInstance) {
  // Self-service : l'user rafraichit les metadonnees de SA bibliotheque.
  app.post(
    "/users/me/library/enrich",
    {
      onRequest: [requireAuth],
      preHandler: app.rateLimit({ max: 5, timeWindow: "1 minute" }),
      schema: {
        tags: ["Games"],
        summary: "Enrichir (IGDB) la bibliotheque de l'utilisateur",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      return enrichGames({ userId: userIdOf(request) });
    },
  );

  // Admin : enrichit / re-synchronise tout le catalogue.
  app.post(
    "/admin/games/enrich",
    {
      onRequest: [requireAuth, requireAdmin],
      preHandler: app.rateLimit({ max: 2, timeWindow: "1 minute" }),
      schema: {
        tags: ["Admin"],
        summary: "Enrichir (IGDB) tout le catalogue",
        security: [{ bearerAuth: [] }],
      },
    },
    async () => {
      return enrichGames({});
    },
  );
}

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireAuth, requireAdmin, userIdOf } from "../../../lib/guards.js";
import { enrichGames } from "./igdb.service.js";
import { getUpcomingGames, getGameDetail, searchIgdbGames } from "./igdb.discovery.service.js";
import {
  upcomingQuerySchema,
  gameDetailParamsSchema,
  searchIgdbQuerySchema,
} from "./igdb.schemas.js";

export async function igdbRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // Feed des jeux a venir (proxy IGDB live + cache Redis). Rate-limit en garde-fou
  // du quota IGDB sur les cache miss.
  r.get(
    "/games/upcoming",
    {
      onRequest: [requireAuth],
      preHandler: app.rateLimit({ max: 60, timeWindow: "1 minute" }),
      schema: {
        tags: ["Games"],
        summary: "Lister les jeux a venir (date de sortie future)",
        security: [{ bearerAuth: [] }],
        querystring: upcomingQuerySchema,
      },
    },
    async (request, reply) => {
      const { limit, offset, sort } = request.query;
      try {
        const items = await getUpcomingGames({ limit, offset, sort });
        return { items, limit, offset };
      } catch (err) {
        request.log.error({ err }, "IGDB upcoming indisponible");
        return reply.code(502).send({ error: "Service IGDB indisponible" });
      }
    },
  );

  // Detail riche d'un jeu par son IGDB id (proxy IGDB live + cache Redis).
  r.get(
    "/games/igdb/:igdbId",
    {
      onRequest: [requireAuth],
      preHandler: app.rateLimit({ max: 60, timeWindow: "1 minute" }),
      schema: {
        tags: ["Games"],
        summary: "Detail d'un jeu par son IGDB ID",
        security: [{ bearerAuth: [] }],
        params: gameDetailParamsSchema,
      },
    },
    async (request, reply) => {
      try {
        const detail = await getGameDetail(request.params.igdbId);
        if (!detail) {
          return reply.code(404).send({ error: "Jeu introuvable sur IGDB" });
        }
        return detail;
      } catch (err) {
        request.log.error({ err }, "IGDB detail indisponible");
        return reply.code(502).send({ error: "Service IGDB indisponible" });
      }
    },
  );

  // Recherche live par nom (autocomplete de l'ajout manuel cote front, proxy IGDB + cache Redis).
  r.get(
    "/games/igdb/search",
    {
      onRequest: [requireAuth],
      preHandler: app.rateLimit({ max: 60, timeWindow: "1 minute" }),
      schema: {
        tags: ["Games"],
        summary: "Recherche live de jeux IGDB par nom",
        security: [{ bearerAuth: [] }],
        querystring: searchIgdbQuerySchema,
      },
    },
    async (request, reply) => {
      const { q, limit } = request.query;
      try {
        const items = await searchIgdbGames(q, limit);
        return { items };
      } catch (err) {
        request.log.error({ err }, "IGDB search indisponible");
        return reply.code(502).send({ error: "Service IGDB indisponible" });
      }
    },
  );

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

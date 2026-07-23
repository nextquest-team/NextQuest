import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireAuth, requireAdmin, userIdOf } from "../../../lib/guards.js";
import { errorResponses } from "../../../lib/openapi.js";
import { enrichGames } from "./igdb.service.js";
import { getUpcomingGames, getGameDetail, searchIgdbGames } from "./igdb.discovery.service.js";
import {
  upcomingQuerySchema,
  gameDetailParamsSchema,
  searchIgdbQuerySchema,
  upcomingGamesResultsSchema,
  igdbSearchResultsSchema,
  enrichSummarySchema,
} from "./igdb.schemas.js";
import { gameDetailDTOSchema } from "./igdb.dto.js";

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
        operationId: "getUpcomingGames",
        summary: "Lister les jeux a venir (date de sortie future)",
        description:
          "Feed des jeux a venir, proxy live IGDB avec cache Redis (1h). Tri par hype (defaut) ou par date de sortie.",
        security: [{ bearerAuth: [] }],
        querystring: upcomingQuerySchema,
        response: {
          200: upcomingGamesResultsSchema,
          ...errorResponses(400, 401, 502),
        },
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
        operationId: "getIgdbGame",
        summary: "Detail d'un jeu par son IGDB ID",
        description:
          "Detail riche d'un jeu (fiche jeu), proxy live IGDB avec cache Redis (24h). Inclut les jeux similaires reclasses par similarite de contenu.",
        security: [{ bearerAuth: [] }],
        params: gameDetailParamsSchema,
        response: {
          200: gameDetailDTOSchema,
          ...errorResponses(400, 401, 404, 502),
        },
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
        operationId: "searchIgdbGames",
        summary: "Recherche live de jeux IGDB par nom",
        description:
          "Autocomplete de l'ajout manuel : recherche IGDB par nom, filtree (non-jeux et editions exclus) et classee par popularite. Chaque resultat indique si le jeu est deja dans la collection de l'utilisateur. Le parametre scope=upcoming restreint aux jeux dont la date de sortie est future.",
        security: [{ bearerAuth: [] }],
        querystring: searchIgdbQuerySchema,
        response: {
          200: igdbSearchResultsSchema,
          ...errorResponses(400, 401, 502),
        },
      },
    },
    async (request, reply) => {
      const { q, limit, scope } = request.query;
      try {
        const items = await searchIgdbGames(q, userIdOf(request), limit, scope);
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
        operationId: "enrichMyLibrary",
        summary: "Enrichir (IGDB) la bibliotheque de l'utilisateur",
        description:
          "Synchronise les metadonnees IGDB (cover, genres, note, similaires...) des jeux de la bibliotheque du user, jamais hydrates ou perimes (30 jours).",
        security: [{ bearerAuth: [] }],
        response: {
          200: enrichSummarySchema,
          ...errorResponses(401),
        },
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
        operationId: "enrichCatalog",
        summary: "Enrichir (IGDB) tout le catalogue",
        description:
          "Synchronise les metadonnees IGDB de tout le catalogue (jamais hydrates ou perimes). Reserve aux administrateurs.",
        security: [{ bearerAuth: [] }],
        response: {
          200: enrichSummarySchema,
          ...errorResponses(401, 403),
        },
      },
    },
    async () => {
      return enrichGames({});
    },
  );
}

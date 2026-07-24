import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  updateGameStatusSchema,
  userGameParamsSchema,
  listCollectionQuerySchema,
  updateUserGameSchema,
  addGameSchema,
  addIgdbGameSchema,
} from "./collection.schemas.js";
import {
  userGameStatusSchema,
  collectionItemSchema,
  collectionDetailSchema,
  listCollectionResultSchema,
} from "./collection.dto.js";
import {
  updateGameStatus,
  listCollection,
  getCollectionItem,
  updateCollectionItem,
  deleteCollectionItem,
  addGameToCollection,
  addIgdbGameToCollection,
  ignoreUserGame,
  restoreUserGame,
} from "./collection.service.js";
import { requireAuth, userIdOf } from "../../lib/guards.js";
import { errorResponses, noContentSchema } from "../../lib/openapi.js";

export async function collectionRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.patch(
    "/collection/:userGameId/status",
    {
      onRequest: [requireAuth],
      schema: {
        tags: ["Collection"],
        operationId: "updateGameStatus",
        summary: "Changer le statut d'un jeu de la collection",
        description:
          "Change le statut (backlog/playing/completed/abandoned) d'un jeu. startedAt/completedAt sont poses automatiquement a la 1re transition vers playing/completed, jamais reecrits ensuite. Chaque changement est trace dans l'historique de statut.",
        security: [{ bearerAuth: [] }],
        params: userGameParamsSchema,
        body: updateGameStatusSchema,
        response: {
          200: userGameStatusSchema,
          ...errorResponses(400, 401, 404),
        },
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

  // Liste paginee de la collection (genres/tags inline, filtre statut).
  r.get(
    "/collection",
    {
      onRequest: [requireAuth],
      schema: {
        tags: ["Collection"],
        operationId: "listCollection",
        summary: "Lister les jeux de la collection",
        description:
          "Liste paginee de la collection de l'utilisateur, genres/tags inline. Filtrable par statut, plateforme(s) (platformId, repetable dans l'URL pour matcher plusieurs plateformes a la fois) et recherche texte sur le titre. Triable via sortBy (recent par defaut, platform, genre). view=library (defaut) exclut les jeux ignores, view=ignored ne montre que ceux-la.",
        security: [{ bearerAuth: [] }],
        querystring: listCollectionQuerySchema,
        response: {
          200: listCollectionResultSchema,
          ...errorResponses(400, 401),
        },
      },
    },
    async (request) => {
      const userId = userIdOf(request);
      const { status, search, platformId, sortBy, limit, offset, includeHidden, view } =
        request.query;
      const { items, total } = await listCollection({
        userId,
        status,
        search,
        platformIds: platformId,
        sortBy,
        limit,
        offset,
        includeHidden,
        view,
      });
      return { items, total, limit, offset };
    },
  );

  // Detail d'un jeu de la collection (description + jeux similaires).
  r.get(
    "/collection/:userGameId",
    {
      onRequest: [requireAuth],
      schema: {
        tags: ["Collection"],
        operationId: "getCollectionItem",
        summary: "Detail d'un jeu de la collection",
        description:
          "Renvoie le detail complet d'un jeu de la collection (description, jeux similaires) en plus des champs de la liste.",
        security: [{ bearerAuth: [] }],
        params: userGameParamsSchema,
        response: {
          200: collectionDetailSchema,
          ...errorResponses(400, 401, 404),
        },
      },
    },
    async (request, reply) => {
      const item = await getCollectionItem(
        userIdOf(request),
        request.params.userGameId,
      );
      if (!item) {
        return reply
          .code(404)
          .send({ error: "Jeu introuvable dans ta collection" });
      }
      return item;
    },
  );

  // Edition des champs hors statut (note, avis, temps de jeu, visibilite).
  r.patch(
    "/collection/:userGameId",
    {
      onRequest: [requireAuth],
      schema: {
        tags: ["Collection"],
        operationId: "updateUserGame",
        summary: "Modifier note / avis / temps de jeu / visibilite",
        description:
          "Edite les champs hors statut d'un jeu de la collection (rating, review, playtimeMinutes, isHidden). Au moins un champ est requis. Le statut a sa propre route dediee (PATCH /collection/:userGameId/status).",
        security: [{ bearerAuth: [] }],
        params: userGameParamsSchema,
        body: updateUserGameSchema,
        response: {
          200: collectionItemSchema,
          ...errorResponses(400, 401, 404),
        },
      },
    },
    async (request, reply) => {
      const item = await updateCollectionItem(
        userIdOf(request),
        request.params.userGameId,
        request.body,
      );
      if (!item) {
        return reply
          .code(404)
          .send({ error: "Jeu introuvable dans ta collection" });
      }
      return item;
    },
  );

  // Retire un jeu de la collection (hard delete + cascade).
  r.delete(
    "/collection/:userGameId",
    {
      onRequest: [requireAuth],
      schema: {
        tags: ["Collection"],
        operationId: "removeGameFromCollection",
        summary: "Retirer un jeu de la collection",
        description:
          "Hard delete : retire definitivement le jeu de la collection (historique de statut et tags associes supprimes en cascade). Le catalogue de jeux partage n'est pas touche.",
        security: [{ bearerAuth: [] }],
        params: userGameParamsSchema,
        response: {
          204: noContentSchema,
          ...errorResponses(400, 401, 404),
        },
      },
    },
    async (request, reply) => {
      const ok = await deleteCollectionItem(
        userIdOf(request),
        request.params.userGameId,
      );
      if (!ok) {
        return reply
          .code(404)
          .send({ error: "Jeu introuvable dans ta collection" });
      }
      return reply.code(204).send(null);
    },
  );

  // Ajoute un jeu existant du catalogue a la collection.
  r.post(
    "/collection",
    {
      onRequest: [requireAuth],
      schema: {
        tags: ["Collection"],
        operationId: "addGameToCollection",
        summary: "Ajouter un jeu existant du catalogue a la collection",
        description:
          "Ajoute un jeu deja present dans notre catalogue a la collection (statut initial backlog). Si le jeu avait ete ignore, il est reactive (statut et historique preserves) plutot que duplique.",
        security: [{ bearerAuth: [] }],
        body: addGameSchema,
        response: {
          201: collectionItemSchema,
          ...errorResponses(400, 401, 404, 409),
        },
      },
    },
    async (request, reply) => {
      const result = await addGameToCollection(userIdOf(request), request.body);
      if (!result.ok) {
        if (result.reason === "game_not_found") {
          return reply.code(404).send({ error: "Jeu introuvable dans le catalogue" });
        }
        if (result.reason === "platform_not_found") {
          return reply.code(404).send({ error: "Plateforme introuvable" });
        }
        return reply.code(409).send({ error: "Ce jeu est deja dans ta collection" });
      }
      return reply.code(201).send(result.item);
    },
  );

  // Ajoute un jeu IGDB a la collection, meme s'il n'est pas encore dans notre
  // catalogue (hydrate au besoin depuis IGDB avant l'ajout).
  r.post(
    "/collection/from-igdb",
    {
      onRequest: [requireAuth],
      schema: {
        tags: ["Collection"],
        operationId: "addIgdbGameToCollection",
        summary: "Ajouter un jeu IGDB (absent ou non du catalogue) a la collection",
        description:
          "Ajoute un jeu identifie par son igdbId a la collection, meme s'il n'est pas encore dans notre catalogue (hydrate une fiche minimale depuis IGDB au besoin avant l'ajout).",
        security: [{ bearerAuth: [] }],
        body: addIgdbGameSchema,
        response: {
          201: collectionItemSchema,
          ...errorResponses(400, 401, 404, 409),
        },
      },
    },
    async (request, reply) => {
      const result = await addIgdbGameToCollection(
        userIdOf(request),
        request.body,
      );
      if (!result.ok) {
        if (result.reason === "igdb_not_found") {
          return reply.code(404).send({ error: "Jeu introuvable sur IGDB" });
        }
        if (result.reason === "platform_not_found") {
          return reply.code(404).send({ error: "Plateforme introuvable" });
        }
        return reply.code(409).send({ error: "Ce jeu est deja dans ta collection" });
      }
      return reply.code(201).send(result.item);
    },
  );

  // Ignore un jeu : il quitte la vue "library" (et un reimport type Steam ne
  // le ramene pas) mais garde statut/notes/historique intacts.
  r.post(
    "/collection/:userGameId/ignore",
    {
      onRequest: [requireAuth],
      schema: {
        tags: ["Collection"],
        operationId: "ignoreGame",
        summary: "Ignorer un jeu de la collection (statut preserve)",
        description:
          "Retire le jeu de la vue library sans rien perdre : statut, note, temps de jeu et historique restent intacts. Un reimport (ex: Steam) ne le fait pas reapparaitre tant qu'il n'est pas restaure.",
        security: [{ bearerAuth: [] }],
        params: userGameParamsSchema,
        response: {
          204: noContentSchema,
          ...errorResponses(400, 401, 404),
        },
      },
    },
    async (request, reply) => {
      const ok = await ignoreUserGame(
        userIdOf(request),
        request.params.userGameId,
      );
      if (!ok) {
        return reply
          .code(404)
          .send({ error: "Jeu introuvable dans ta collection" });
      }
      return reply.code(204).send(null);
    },
  );

  // Retire l'ignore : le jeu revient dans la vue "library", statut intact.
  r.post(
    "/collection/:userGameId/restore",
    {
      onRequest: [requireAuth],
      schema: {
        tags: ["Collection"],
        operationId: "restoreGame",
        summary: "Restaurer un jeu ignore dans la collection",
        description:
          "Retire l'etat ignore d'un jeu : il revient dans la vue library avec son statut intact.",
        security: [{ bearerAuth: [] }],
        params: userGameParamsSchema,
        response: {
          204: noContentSchema,
          ...errorResponses(400, 401, 404),
        },
      },
    },
    async (request, reply) => {
      const ok = await restoreUserGame(
        userIdOf(request),
        request.params.userGameId,
      );
      if (!ok) {
        return reply
          .code(404)
          .send({ error: "Jeu introuvable dans ta collection" });
      }
      return reply.code(204).send(null);
    },
  );
}

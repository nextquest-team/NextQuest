import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  updateGameStatusSchema,
  userGameParamsSchema,
  listCollectionQuerySchema,
  updateUserGameSchema,
  addGameSchema,
} from "./collection.schemas.js";
import {
  updateGameStatus,
  listCollection,
  getCollectionItem,
  updateCollectionItem,
  deleteCollectionItem,
  addGameToCollection,
} from "./collection.service.js";
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

  // Liste paginee de la collection (genres/tags inline, filtre statut).
  r.get(
    "/collection",
    {
      onRequest: [requireAuth],
      schema: {
        tags: ["Collection"],
        summary: "Lister les jeux de la collection",
        security: [{ bearerAuth: [] }],
        querystring: listCollectionQuerySchema,
      },
    },
    async (request) => {
      const userId = userIdOf(request);
      const { status, search, limit, offset, includeHidden } = request.query;
      const { items, total } = await listCollection({
        userId,
        status,
        search,
        limit,
        offset,
        includeHidden,
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
        summary: "Detail d'un jeu de la collection",
        security: [{ bearerAuth: [] }],
        params: userGameParamsSchema,
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
        summary: "Modifier note / avis / temps de jeu / visibilite",
        security: [{ bearerAuth: [] }],
        params: userGameParamsSchema,
        body: updateUserGameSchema,
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
        summary: "Retirer un jeu de la collection",
        security: [{ bearerAuth: [] }],
        params: userGameParamsSchema,
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
      return reply.code(204).send();
    },
  );

  // Ajoute un jeu existant du catalogue a la collection.
  r.post(
    "/collection",
    {
      onRequest: [requireAuth],
      schema: {
        tags: ["Collection"],
        summary: "Ajouter un jeu existant du catalogue a la collection",
        security: [{ bearerAuth: [] }],
        body: addGameSchema,
      },
    },
    async (request, reply) => {
      const result = await addGameToCollection(userIdOf(request), request.body);
      if (!result.ok) {
        return result.reason === "game_not_found"
          ? reply.code(404).send({ error: "Jeu introuvable dans le catalogue" })
          : reply.code(409).send({ error: "Ce jeu est deja dans ta collection" });
      }
      return reply.code(201).send(result.item);
    },
  );
}

import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { userDTOSchema } from "./users.dto.js";
import {
  uploadUserAvatar,
  removeUserAvatar,
  InvalidImageError,
  AVATAR_MAX_BYTES,
} from "./avatar.service.js";
import { StorageError } from "../../lib/storage.js";
import { requireAuth, userIdOf } from "../../lib/guards.js";
import { errorResponses, noContentSchema } from "../../lib/openapi.js";

export async function avatarRoutes(app: FastifyInstance) {
  // Multipart enregistre ICI (encapsulation Fastify) : seules ces routes
  // acceptent des uploads, le reste de l'API reste JSON-only.
  await app.register(multipart, {
    limits: { fileSize: AVATAR_MAX_BYTES, files: 1 },
  });

  app.post(
    "/users/me/avatar",
    {
      onRequest: [requireAuth],
      // Limite dediee, plus stricte que le filet global (300/min) : le
      // recadrage/reencodage sharp cote serveur coute du CPU par requete,
      // pas question de laisser un abus d'upload saturer le process.
      config: { rateLimit: { max: 10, timeWindow: "1 hour" } },
      schema: {
        tags: ["Users"],
        operationId: "uploadMyAvatar",
        summary: "Upload de l'avatar",
        description:
          "Remplace l'avatar par l'image envoyee (multipart, un champ fichier). Formats jpeg/png/webp, 5 Mo max. L'image est recadree en 512x512, convertie en WebP et servie depuis le stockage objet.",
        security: [{ bearerAuth: [] }],
        consumes: ["multipart/form-data"],
        // Exception au pattern Zod-body (comme le callback OAuth) : un corps
        // multipart n'est pas descriptible en Zod, la validation taille/format
        // est faite a la main dans le handler.
        response: {
          200: userDTOSchema,
          ...errorResponses(400, 401, 413, 429, 503),
        },
      },
    },
    async (request, reply) => {
      const userId = userIdOf(request);

      // Un multipart illisible (content-type errone, boundary invalide) est une
      // erreur du client : 400 explicite plutot qu'un 500 du parseur.
      let file: Awaited<ReturnType<typeof request.file>>;
      try {
        file = await request.file();
      } catch {
        return reply.code(400).send({ error: "Requete multipart invalide" });
      }
      if (!file) {
        return reply.code(400).send({ error: "Aucun fichier recu (champ multipart attendu)" });
      }

      let buf: Buffer;
      try {
        buf = await file.toBuffer();
      } catch (err) {
        if (
          err instanceof Error &&
          "code" in err &&
          (err as { code: string }).code === "FST_REQ_FILE_TOO_LARGE"
        ) {
          return reply.code(413).send({ error: "Fichier trop volumineux (5 Mo max)" });
        }
        throw err;
      }

      try {
        const dto = await uploadUserAvatar(userId, buf);
        return reply.send(dto);
      } catch (err) {
        if (err instanceof InvalidImageError) {
          return reply.code(400).send({ error: err.message });
        }
        if (err instanceof StorageError) {
          request.log.error(err, "stockage objet indisponible");
          return reply.code(503).send({ error: "Stockage indisponible, reessayez plus tard" });
        }
        throw err;
      }
    },
  );

  app.delete(
    "/users/me/avatar",
    {
      onRequest: [requireAuth],
      schema: {
        tags: ["Users"],
        operationId: "deleteMyAvatar",
        summary: "Suppression de l'avatar",
        description:
          "Supprime l'avatar uploade et remet avatar_url a null (le front retombe sur l'avatar genere). Idempotent.",
        security: [{ bearerAuth: [] }],
        response: {
          204: noContentSchema,
          ...errorResponses(401, 503),
        },
      },
    },
    async (request, reply) => {
      const userId = userIdOf(request);
      try {
        await removeUserAvatar(userId);
      } catch (err) {
        if (err instanceof StorageError) {
          request.log.error(err, "stockage objet indisponible");
          return reply.code(503).send({ error: "Stockage indisponible, reessayez plus tard" });
        }
        throw err;
      }
      return reply.code(204).send(null);
    },
  );
}

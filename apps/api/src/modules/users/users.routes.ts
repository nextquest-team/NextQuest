import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { updateProfileSchema, onboardingResultSchema } from "./users.schemas.js";
import { userDTOSchema } from "./users.dto.js";
import {
  getUserById,
  updateProfile,
  completeOnboarding,
} from "./users.service.js";
import { requireAuth, userIdOf } from "../../lib/guards.js";
import { errorResponses } from "../../lib/openapi.js";

export async function usersRoutes(app: FastifyInstance) {
  // Profil de l'utilisateur authentifie. Equivalent fonctionnel de /auth/me.
  // Le front utilise l'un ou l'autre selon le contexte (auth = post-login,
  // users = pages settings/profil).
  app.get(
    "/users/me",
    {
      onRequest: [requireAuth],
      schema: {
        tags: ["Users"],
        operationId: "getMyProfile",
        summary: "Profil de l'utilisateur connecte",
        description:
          "Renvoie le profil public du user. Equivalent de GET /auth/me, utilise par les pages profil/parametres. 404 si le compte est soft-deleted.",
        security: [{ bearerAuth: [] }],
        response: {
          200: userDTOSchema,
          ...errorResponses(401, 404),
        },
      },
    },
    async (request, reply) => {
      const userId = userIdOf(request);
      const dto = await getUserById(userId);
      if (!dto) {
        return reply.code(404).send({ error: "Utilisateur introuvable" });
      }
      return reply.send(dto);
    },
  );

  // Edition partielle du profil. Au moins un champ doit etre fourni.
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.patch(
    "/users/me",
    {
      onRequest: [requireAuth],
      schema: {
        tags: ["Users"],
        operationId: "updateMyProfile",
        summary: "Mise a jour du profil",
        description:
          "Met a jour displayName, avatarUrl, bio, locale, visibility. Tous optionnels mais au moins un requis. Renvoie le profil mis a jour.",
        security: [{ bearerAuth: [] }],
        body: updateProfileSchema,
        response: {
          200: userDTOSchema,
          ...errorResponses(400, 401),
        },
      },
    },
    async (request, reply) => {
      const userId = userIdOf(request);
      const input = request.body;
      const dto = await updateProfile(userId, input);
      return reply.send(dto);
    },
  );

  // Marque le tour d'onboarding comme termine. Idempotent.
  app.post(
    "/users/me/onboarding/complete",
    {
      onRequest: [requireAuth],
      schema: {
        tags: ["Users"],
        operationId: "completeOnboarding",
        summary: "Termine le tour d'onboarding",
        description:
          "Passe le flag onboardingCompleted a true. Idempotent : un appel sur un user deja a true renvoie 200 sans erreur.",
        security: [{ bearerAuth: [] }],
        response: {
          200: onboardingResultSchema,
          ...errorResponses(401),
        },
      },
    },
    async (request, reply) => {
      const userId = userIdOf(request);
      const result = await completeOnboarding(userId);
      return reply.send(result);
    },
  );
}

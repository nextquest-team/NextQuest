import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { updateProfileSchema } from "./users.schemas.js";
import {
  getUserById,
  updateProfile,
  completeOnboarding,
} from "./users.service.js";
import { requireAuth, userIdOf } from "../../lib/guards.js";

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
        summary: "Profil de l'utilisateur connecte",
        description:
          "Renvoie le DTO public du user (id, email, username, displayName, avatarUrl, bio, locale, visibility, emailVerified, onboardingCompleted, createdAt). 404 si soft-deleted.",
        security: [{ bearerAuth: [] }],
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
        summary: "Mise a jour du profil",
        description:
          "Met a jour displayName, avatarUrl, bio, locale, visibility. Tous optionnels mais au moins un requis. 400 si validation echoue.",
        security: [{ bearerAuth: [] }],
        body: updateProfileSchema,
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
        summary: "Termine le tour d'onboarding",
        description:
          "Passe le flag onboardingCompleted a true. Idempotent : un appel sur un user deja a true renvoie 200 sans erreur.",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const userId = userIdOf(request);
      const result = await completeOnboarding(userId);
      return reply.send(result);
    },
  );
}

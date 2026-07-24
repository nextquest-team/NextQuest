import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { verify } from "argon2";
import { db, users } from "@nextquest/db";
import { eq } from "drizzle-orm";
import { softDeleteAccount } from "./account-deletion.service.js";
import { deleteAccountSchema, deletionResultSchema } from "../auth/auth.schemas.js";
import { requireAuth, userIdOf } from "../../lib/guards.js";
import { errorResponses } from "../../lib/openapi.js";

export async function accountDeletionRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.delete(
    "/users/me",
    {
      onRequest: [requireAuth],
      // Action rare et sensible : limite serree, le filet global ne suffit pas.
      config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
      schema: {
        tags: ["Users"],
        operationId: "deleteMyAccount",
        summary: "Suppression du compte (grace de 30 jours)",
        description:
          "Place le compte en attente de suppression : sessions revoquees, compte invisible, purge definitive apres la grace (ACCOUNT_PURGE_GRACE_DAYS). Mot de passe requis pour les comptes locaux. Restauration possible via le login puis POST /auth/restore. Idempotent.",
        security: [{ bearerAuth: [] }],
        body: deleteAccountSchema,
        response: {
          200: deletionResultSchema,
          ...errorResponses(400, 401, 429),
        },
      },
    },
    async (request, reply) => {
      const userId = userIdOf(request);
      const [user] = await db
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!user) {
        return reply.code(401).send({ error: "Utilisateur introuvable" });
      }

      // Re-confirmation pour les comptes locaux : un token vole ne suffit pas.
      if (user.passwordHash) {
        const password = request.body?.password;
        if (!password) {
          return reply.code(400).send({ error: "Mot de passe requis pour supprimer le compte" });
        }
        const valid = await verify(user.passwordHash, password);
        if (!valid) {
          return reply.code(401).send({ error: "Mot de passe incorrect" });
        }
      }

      const result = await softDeleteAccount(userId);
      return reply.send({
        deletedAt: result.deletedAt.toISOString(),
        purgeAfter: result.purgeAfter.toISOString(),
      });
    },
  );
}

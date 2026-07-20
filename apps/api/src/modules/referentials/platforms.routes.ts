import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { listPlatforms } from "./platforms.service.js";
import { requireAuth } from "../../lib/guards.js";

export async function platformsRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // Liste des plateformes du referentiel, triee par nom.
  r.get(
    "/platforms",
    {
      onRequest: [requireAuth],
      schema: {
        tags: ["Referentials"],
        summary: "Lister les plateformes du referentiel",
        security: [{ bearerAuth: [] }],
      },
    },
    async () => {
      const items = await listPlatforms();
      return { items };
    },
  );
}

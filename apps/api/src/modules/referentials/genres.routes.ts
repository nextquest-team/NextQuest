import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { listGenres } from "./genres.service.js";
import { requireAuth } from "../../lib/guards.js";
import { genresListSchema } from "./genres.schemas.js";
import { errorResponses } from "../../lib/openapi.js";

export async function genresRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // Liste des genres du referentiel, triee par nom.
  r.get(
    "/genres",
    {
      onRequest: [requireAuth],
      schema: {
        tags: ["Referentials"],
        operationId: "listGenres",
        summary: "Lister les genres du referentiel",
        security: [{ bearerAuth: [] }],
        response: {
          200: genresListSchema,
          ...errorResponses(401),
        },
      },
    },
    async () => {
      const items = await listGenres();
      return { items };
    },
  );
}

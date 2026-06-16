import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { healthController } from "./health.controller.js";

export async function healthRoutes(app: FastifyInstance) {
  // Schema de reponse en Zod (et non JSON Schema brut) : le transform OpenAPI
  // global (jsonSchemaTransform) attend du Zod sur toutes les routes, sinon il
  // rejette le schema a la generation de la doc.
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.get("/health", {
    // Pas de rate limit : les probes (k8s, monitoring) tapent souvent
    config: { rateLimit: false },
    schema: {
      tags: ["Health"],
      summary: "Verifier que l'API est en ligne",
      response: {
        200: z.object({
          status: z.string(),
          timestamp: z.string(),
        }),
      },
    },
    handler: healthController.check,
  });
}

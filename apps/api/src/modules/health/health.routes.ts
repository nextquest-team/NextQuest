import type { FastifyInstance } from "fastify";
import { healthController } from "./health.controller.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", {
    // Pas de rate limit : les probes (k8s, monitoring) tapent souvent
    config: { rateLimit: false },
    schema: {
      tags: ["Health"],
      summary: "Verifier que l'API est en ligne",
      response: {
        200: {
          type: "object",
          properties: {
            status: { type: "string" },
            timestamp: { type: "string" },
          },
        },
      },
    },
    handler: healthController.check,
  });
}

import type { FastifyInstance } from "fastify";
import { healthController } from "./health.controller.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", {
    schema: {
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

import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";

// Handler d'erreurs commun a l'app et aux apps de test. Convertit les erreurs de
// validation (type-provider Zod, ou ZodError encore lancee a la main dans un
// handler) en 400 { error, details }, conserve les statusCode explicites, et
// renvoie 500 sinon.
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.code(400).send({
        error: "Validation Error",
        details: error.validation.map((v) => ({
          field: v.instancePath.slice(1).split("/").join("."),
          message: v.message,
        })),
      });
    }

    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "Validation Error",
        details: error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    app.log.error(error);
    return reply.code(error.statusCode ?? 500).send({
      error: error.message || "Internal Server Error",
    });
  });
}

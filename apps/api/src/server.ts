import { config } from "dotenv";
config({ path: "../../.env" });
import Fastify from "fastify";
import { ZodError } from "zod";
import { registerCors } from "./plugins/cors.js";
import { registerSwagger } from "./plugins/swagger.js";
import { registerJwt } from "./plugins/jwt.js";
import { registerCookie } from "./plugins/cookie.js";
import { registerRateLimit } from "./plugins/rate-limit.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";

const app = Fastify({
  logger: {
    transport: {
      target: "pino-pretty",
    },
  },
});

// Erreurs de validation Zod -> 400 avec details exploitables par le client.
// `error` est typee unknown depuis Fastify 5.8.5, on raffine avec le shape
// minimal qu'on consomme (statusCode optionnel, message d'Error standard).
app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
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

async function start() {
  // L'ordre d'enregistrement compte : CORS et Swagger d'abord (infra),
  // puis JWT et Cookie (securite), puis les routes (fonctionnel)
  await registerCors(app);
  await registerSwagger(app);
  await registerJwt(app);
  await registerCookie(app);
  await registerRateLimit(app);

  await app.register(healthRoutes, { prefix: "/api" });
  await app.register(authRoutes, { prefix: "/api" });

  const port = Number(process.env.PORT) || 3000;

  await app.listen({ port, host: "0.0.0.0" });
  console.log(`API running on http://localhost:${port}`);
  console.log(`Docs on http://localhost:${port}/docs`);
}

start().catch((err) => {
  app.log.error(err);
  process.exit(1);
});

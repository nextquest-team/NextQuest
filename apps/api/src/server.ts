import { config } from "dotenv";
config({ path: "../../.env" });
import Fastify from "fastify";
import { registerCors } from "./plugins/cors.js";
import { registerSwagger } from "./plugins/swagger.js";
import { registerJwt } from "./plugins/jwt.js";
import { registerCookie } from "./plugins/cookie.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";

const app = Fastify({
  logger: {
    transport: {
      target: "pino-pretty",
    },
  },
});

async function start() {
  // L'ordre d'enregistrement compte : CORS et Swagger d'abord (infra),
  // puis JWT et Cookie (securite), puis les routes (fonctionnel)
  await registerCors(app);
  await registerSwagger(app);
  await registerJwt(app);
  await registerCookie(app);

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

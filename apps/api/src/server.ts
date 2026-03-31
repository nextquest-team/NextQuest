import "dotenv/config";
import Fastify from "fastify";
import { registerCors } from "./plugins/cors.js";
import { registerSwagger } from "./plugins/swagger.js";
import { healthRoutes } from "./modules/health/health.routes.js";

const app = Fastify({
  logger: {
    transport: {
      target: "pino-pretty",
    },
  },
});

async function start() {
  await registerCors(app);
  await registerSwagger(app);

  await app.register(healthRoutes, { prefix: "/api" });

  const port = Number(process.env.PORT) || 3000;

  await app.listen({ port, host: "0.0.0.0" });
  console.log(`API running on http://localhost:${port}`);
  console.log(`Docs on http://localhost:${port}/docs`);
}

start().catch((err) => {
  app.log.error(err);
  process.exit(1);
});

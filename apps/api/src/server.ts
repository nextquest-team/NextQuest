import { config } from "dotenv";
config({ path: "../../.env" });
import Fastify from "fastify";
import { validatorCompiler, serializerCompiler } from "fastify-type-provider-zod";
import { registerCors } from "./plugins/cors.js";
import { registerSwagger } from "./plugins/swagger.js";
import { registerJwt } from "./plugins/jwt.js";
import { registerCookie } from "./plugins/cookie.js";
import { registerRateLimit } from "./plugins/rate-limit.js";
import { registerErrorHandler } from "./lib/error-handler.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { oauthRoutes } from "./modules/auth/oauth/oauth.routes.js";
import { usersRoutes } from "./modules/users/users.routes.js";
import { steamRoutes } from "./modules/platforms/steam/steam.routes.js";
import { collectionRoutes } from "./modules/collection/collection.routes.js";
import { recommendationsRoutes } from "./modules/recommendations/recommendations.routes.js";
import { igdbRoutes } from "./modules/games/igdb/igdb.routes.js";
import { followRoutes } from "./modules/games/follow/follow.routes.js";
import { gamesRoutes } from "./modules/games/games.routes.js";
import { platformsRoutes } from "./modules/referentials/platforms.routes.js";
import { genresRoutes } from "./modules/referentials/genres.routes.js";
import { scheduleReleaseRefresh } from "./modules/games/refresh/release-refresh.scheduler.js";

const app = Fastify({
  logger: {
    transport: {
      target: "pino-pretty",
    },
  },
  // L'API tourne derriere un reverse proxy (Docker bridge en dev, proxy applicatif en prod).
  // Sans trustProxy, request.ip retourne l'IP du dernier hop (la gateway Docker 172.18.0.1)
  // au lieu de la vraie IP client portee par X-Forwarded-For. Indispensable pour que
  // sessions.ip_address et le rate-limiter par IP soient corrects.
  trustProxy: true,
});

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

registerErrorHandler(app);

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
  await app.register(usersRoutes, { prefix: "/api" });
  await app.register(steamRoutes, { prefix: "/api" });
  await app.register(collectionRoutes, { prefix: "/api" });
  await app.register(recommendationsRoutes, { prefix: "/api" });
  await app.register(igdbRoutes, { prefix: "/api" });
  await app.register(followRoutes, { prefix: "/api" });
  await app.register(gamesRoutes, { prefix: "/api" });
  await app.register(platformsRoutes, { prefix: "/api" });
  await app.register(genresRoutes, { prefix: "/api" });
  await app.register(oauthRoutes, { prefix: "/api/auth" });

  const port = Number(process.env.PORT) || 3000;

  await app.listen({ port, host: "0.0.0.0" });
  console.log(`API running on http://localhost:${port}`);
  console.log(`Docs on http://localhost:${port}/docs`);

  scheduleReleaseRefresh(app.log);
}

start().catch((err) => {
  app.log.error(err);
  process.exit(1);
});

import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";

// Rate limiting global. Sert de filet de securite contre les abus generaux
// (scraping, fuzzing). Les routes sensibles (auth) overrident ces valeurs
// avec des limites beaucoup plus strictes via `config.rateLimit` au niveau
// route. Les routes publiques de read peuvent desactiver via `rateLimit: false`.
export async function registerRateLimit(app: FastifyInstance) {
  await app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
    // Renvoyer un 429 explicite plutot que la 503 par defaut
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: `Trop de requetes. Reessayez dans ${context.after}.`,
    }),
  });
}

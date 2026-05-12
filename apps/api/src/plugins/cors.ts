import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";

// Origins autorisees lues depuis CORS_ORIGINS (CSV), fallback localhost
// pour le dev en local. Permet de whitelist le hostname Tailscale en
// dev distant sans hardcoder.
function parseOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw) return ["http://localhost:3001"];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export async function registerCors(app: FastifyInstance) {
  await app.register(cors, {
    origin: parseOrigins(),
    credentials: true,
  });
}

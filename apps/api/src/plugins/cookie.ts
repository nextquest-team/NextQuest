import type { FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";

// Necessaire pour lire/ecrire le refresh token en cookie httpOnly
// (plus securise qu'en localStorage car inaccessible au JS client)
export async function registerCookie(app: FastifyInstance) {
  await app.register(fastifyCookie);
}

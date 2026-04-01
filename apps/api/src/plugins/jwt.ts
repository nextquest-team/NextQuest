import type { FastifyInstance } from "fastify";
import fastifyJwt from "@fastify/jwt";

// Enregistre @fastify/jwt : ajoute app.jwt.sign() et request.jwtVerify() sur l'instance
export async function registerJwt(app: FastifyInstance) {
  await app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || "dev-secret-change-in-production",
  });
}

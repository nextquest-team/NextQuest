import type { FastifyReply, FastifyRequest } from "fastify";

// Gardes d'autorisation reutilisables. requireAuth verifie le JWT ; requireAdmin
// s'execute ensuite et lit le role porte par le token (signe { sub, role }).

export const requireAuth = async (req: FastifyRequest) => {
  await req.jwtVerify();
};

export const requireAdmin = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  const role = (req.user as { role?: string } | undefined)?.role;
  if (role !== "admin") {
    return reply.code(403).send({ error: "Acces reserve aux administrateurs" });
  }
};

export function userIdOf(request: FastifyRequest): string {
  return (request.user as { sub: string }).sub;
}

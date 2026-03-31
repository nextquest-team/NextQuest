import type { FastifyReply, FastifyRequest } from "fastify";

export const healthController = {
  async check(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  },
};

import type { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

export async function registerSwagger(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      info: {
        title: "NextQuest API",
        description:
          "API de gestion de ludotheque videoludique. Authentification via JWT Bearer ou cookie HttpOnly.",
        version: "0.1.0",
      },
      tags: [
        { name: "Health", description: "Etat de l'API" },
        {
          name: "Auth",
          description:
            "Inscription, connexion, sessions et gestion du compte utilisateur",
        },
        {
          name: "OAuth",
          description: "Connexion via Google ou Microsoft, liaison de comptes",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description:
              "Access token JWT renvoye par /auth/login, /auth/register ou /auth/refresh.",
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
  });
}

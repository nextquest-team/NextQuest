import type { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { jsonSchemaTransform } from "fastify-type-provider-zod";

export async function registerSwagger(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "NextQuest API",
        version: "0.1.0",
        description: [
          "API REST de gestion de ludotheque videoludique : collection multi-plateformes,",
          "suivi de progression, recommandations algorithmiques et metadonnees de jeux (IGDB).",
          "",
          "## Authentification",
          "Deux mecanismes complementaires :",
          "- **Access token JWT** (`bearerAuth`) : dure 15 min, a passer dans l'en-tete",
          "  `Authorization: Bearer <token>`. Renvoye par `/auth/register`, `/auth/login`",
          "  et `/auth/refresh`.",
          "- **Refresh token** (`cookieAuth`) : dure 30 jours, stocke dans un cookie HttpOnly",
          "  `refresh_token` (ou renvoye dans le body pour le mobile). Sert a obtenir un nouvel",
          "  access token via `/auth/refresh` (rotation avec detection de reutilisation).",
          "",
          "## Format des erreurs",
          "- `400` (validation) : `{ error: \"Validation Error\", details: [{ field, message }] }`",
          "- autres (`401`, `403`, `404`, `409`, `500`...) : `{ error: \"message lisible\" }`",
          "",
          "## Conventions",
          "- Les listes paginees renvoient `{ items, total }` et acceptent `limit` / `offset`.",
          "- Les dates sont au format ISO 8601 (ou `YYYY-MM-DD` pour les dates seules).",
          "- Rate limiting actif sur les routes sensibles (inscription, connexion, refresh).",
        ].join("\n"),
        contact: {
          name: "Equipe NextQuest",
          url: "https://github.com/nextquest-team/NextQuest",
        },
      },
      servers: [
        { url: "/", description: "Serveur courant" },
        { url: "http://localhost:3000", description: "Developpement local" },
      ],
      // Ordre volontaire : parcours utilisateur (sante, auth, compte, collection,
      // catalogue, reco) puis integrations et administration.
      tags: [
        { name: "Health", description: "Sonde d'etat de l'API" },
        {
          name: "Auth",
          description:
            "Inscription, connexion, sessions (refresh/rotation) et deconnexion",
        },
        {
          name: "OAuth",
          description: "Connexion et liaison de comptes via Google ou Microsoft",
        },
        { name: "Users", description: "Profil et onboarding de l'utilisateur" },
        {
          name: "Collection",
          description:
            "Bibliotheque de jeux de l'utilisateur : ajout, statut, notes, jeux ignores",
        },
        {
          name: "Games",
          description:
            "Catalogue interne et metadonnees IGDB (recherche, detail, sorties a venir)",
        },
        {
          name: "Recommendations",
          description:
            "Recommandations personnalisees (moteur algorithmique) et feedback",
        },
        {
          name: "Platforms",
          description: "Liaison et import des comptes de plateformes (Steam)",
        },
        {
          name: "Referentials",
          description: "Donnees de reference (liste des plateformes)",
        },
        {
          name: "Admin",
          description: "Operations d'administration (reservees au role admin)",
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
          cookieAuth: {
            type: "apiKey",
            in: "cookie",
            name: "refresh_token",
            description:
              "Refresh token (cookie HttpOnly) utilise par /auth/refresh et /auth/logout.",
          },
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      // Confort de navigation : tri alphabetique, liens profonds, et on garde
      // le token saisi entre deux rechargements de la page.
      docExpansion: "list",
      deepLinking: true,
      persistAuthorization: true,
      tagsSorter: "alpha",
      operationsSorter: "alpha",
    },
  });
}

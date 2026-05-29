import type { FastifyInstance } from "fastify";
import { buildSteamLoginUrl, verifySteamAssertion } from "./steam.openid.js";
import { getOwnedGames, getPlayerSummary } from "./steam.client.js";
import {
  linkSteamAccount,
  unlinkSteamAccount,
  getSteamConnection,
  importSteamLibrary,
} from "./steam.service.js";

// URL publique de l'API (joignable par le browser) pour realm + return_to OpenID.
const CALLBACK_BASE =
  process.env.OAUTH_CALLBACK_BASE_URL ?? "http://localhost:3000";
const FRONTEND_URL = process.env.OAUTH_REDIRECT_URL ?? "http://localhost:3001";
const STATE_SCOPE = "steam_link";

const requireAuth = async (req: { jwtVerify(): Promise<unknown> }) =>
  req.jwtVerify();

function userIdOf(request: { user: unknown }): string {
  return (request.user as { sub: string }).sub;
}

export async function steamRoutes(app: FastifyInstance) {
  // Demarrage du linking : l'user est deja authentifie. Son identite est portee
  // a travers la redirection Steam par un state JWT court signe ici.
  app.get(
    "/platforms/steam/link",
    {
      onRequest: [requireAuth],
      preHandler: app.rateLimit({ max: 30, timeWindow: "1 minute" }),
      schema: {
        tags: ["Platforms"],
        summary: "Demarrer la liaison du compte Steam (OpenID)",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const userId = userIdOf(request);
      const state = app.jwt.sign(
        { sub: userId, scope: STATE_SCOPE },
        { expiresIn: "10m" },
      );
      const returnTo = `${CALLBACK_BASE}/api/platforms/steam/callback?state=${encodeURIComponent(state)}`;
      const url = buildSteamLoginUrl({ realm: CALLBACK_BASE, returnTo });
      return { url };
    },
  );

  // Retour de Steam. Pas de JWT (redirection top-level) : l'identite vient du state.
  app.get(
    "/platforms/steam/callback",
    {
      preHandler: app.rateLimit({ max: 20, timeWindow: "1 minute" }),
      schema: {
        tags: ["Platforms"],
        summary: "Callback OpenID Steam",
      },
    },
    async (request, reply) => {
      const query = request.query as Record<string, string>;

      let userId: string;
      try {
        const decoded = app.jwt.verify(query.state ?? "") as {
          sub: string;
          scope?: string;
        };
        if (decoded.scope !== STATE_SCOPE) throw new Error("scope invalide");
        userId = decoded.sub;
      } catch {
        return reply.code(401).send({ error: "State invalide ou expire" });
      }

      const steamId = await verifySteamAssertion(query);
      if (!steamId) {
        return reply.code(401).send({ error: "Assertion Steam invalide" });
      }

      const summary = await getPlayerSummary(
        steamId,
        process.env.STEAM_API_KEY ?? "",
      );
      await linkSteamAccount(userId, steamId, summary?.personaName ?? null);

      return reply.redirect(`${FRONTEND_URL}/settings?steam=linked`);
    },
  );

  // Statut de la connexion Steam de l'user.
  app.get(
    "/platforms/steam",
    {
      onRequest: [requireAuth],
      schema: {
        tags: ["Platforms"],
        summary: "Statut de la connexion Steam",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const conn = await getSteamConnection(userIdOf(request));
      return {
        connected: conn !== null,
        steamId: conn?.steamId ?? null,
        personaName: conn?.personaName ?? null,
      };
    },
  );

  // Deliaison du compte Steam.
  app.delete(
    "/platforms/steam",
    {
      onRequest: [requireAuth],
      schema: {
        tags: ["Platforms"],
        summary: "Delier le compte Steam",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const unlinked = await unlinkSteamAccount(userIdOf(request));
      return { unlinked };
    },
  );

  // Import de la bibliotheque Steam liee.
  app.post(
    "/platforms/steam/import",
    {
      onRequest: [requireAuth],
      preHandler: app.rateLimit({ max: 10, timeWindow: "1 minute" }),
      schema: {
        tags: ["Platforms"],
        summary: "Importer la bibliotheque Steam",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const userId = userIdOf(request);

      const conn = await getSteamConnection(userId);
      if (!conn) {
        return reply.code(409).send({ error: "Aucun compte Steam lie" });
      }

      const ownedGames = await getOwnedGames(
        conn.steamId,
        process.env.STEAM_API_KEY ?? "",
      );

      if (ownedGames.length === 0) {
        return reply.send({
          imported: 0,
          warning:
            "Aucun jeu recupere. Verifie que les details de jeu de ton profil Steam sont en public.",
        });
      }

      const imported = await importSteamLibrary(userId, ownedGames);
      return reply.send({ imported });
    },
  );
}

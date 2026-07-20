import type { FastifyInstance } from "fastify";
import { buildSteamLoginUrl, verifySteamAssertion } from "./steam.openid.js";
import { getOwnedGames, getPlayerSummary } from "./steam.client.js";
import {
  linkSteamAccount,
  unlinkSteamAccount,
  getSteamConnection,
  importSteamLibrary,
} from "./steam.service.js";
import { getImportStatus } from "./import-status.service.js";
import { enrichGames } from "../../games/igdb/igdb.service.js";
import { generateRecommendations } from "../../recommendations/generate.js";
import { requireAuth, userIdOf } from "../../../lib/guards.js";

// URL publique de l'API (joignable par le browser) pour realm + return_to OpenID.
const CALLBACK_BASE =
  process.env.OAUTH_CALLBACK_BASE_URL ?? "http://localhost:3000";
const FRONTEND_URL = process.env.OAUTH_REDIRECT_URL ?? "http://localhost:3001";
const STATE_SCOPE = "steam_link";

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

      return reply.redirect(`${FRONTEND_URL}/game-list?steam=linked`);
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

      let ownedGames;
      try {
        ownedGames = await getOwnedGames(
          conn.steamId,
          process.env.STEAM_API_KEY ?? "",
        );
      } catch {
        return reply.code(502).send({
          error: "Steam est temporairement indisponible. Reessaie plus tard.",
        });
      }

      if (ownedGames.length === 0) {
        return reply.send({
          imported: 0,
          warning:
            "Aucun jeu recupere. Verifie que les details de jeu de ton profil Steam sont en public.",
        });
      }

      const imported = await importSteamLibrary(userId, ownedGames);

      // Enrichissement IGDB suivi de la generation de recos en fire-and-forget :
      // on ne bloque pas la reponse (l'user voit sa biblio tout de suite, les
      // metadonnees et recos arrivent apres). Les passes sont idempotentes,
      // un echec est rattrape au prochain import/declenchement manuel.
      void enrichGames({ userId })
        .then(() => generateRecommendations(userId, request.log))
        .catch((err) => {
          request.log.error({ err }, "Enrichissement/generation reco post-import echoue");
        });

      return reply.send({ imported });
    },
  );

  // Statut de l'enrichissement IGDB en cours, poll par le front pour la modale
  // de progression apres un import (jaquettes qui arrivent au fil de l'eau).
  app.get(
    "/platforms/steam/import/status",
    {
      onRequest: [requireAuth],
      schema: {
        tags: ["Platforms"],
        summary: "Statut de la progression d'enrichissement de la bibliotheque",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      return getImportStatus(userIdOf(request));
    },
  );
}

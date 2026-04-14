import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  getProviderConfig,
  buildAuthorizationUrl,
  buildCallbackUrl,
  getSupportedProviders,
} from "./oauth.config.js";
import { googleProvider } from "./providers/google.js";
import { microsoftProvider } from "./providers/microsoft.js";
import {
  findOrCreateUserFromOAuth,
  linkProviderToUser,
  unlinkProviderFromUser,
} from "./oauth.service.js";
import { createSession } from "../auth.service.js";
import type { OAuthProvider } from "./providers/types.js";

const OAUTH_REDIRECT_URL = process.env.OAUTH_REDIRECT_URL ?? "http://localhost:3001";

const STATE_COOKIE = "oauth_state";
const STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/auth/oauth",
  maxAge: 300, // 5 minutes
};

const REFRESH_COOKIE = "refresh_token";
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api/auth",
  maxAge: 30 * 24 * 60 * 60,
};

const providers: Record<string, OAuthProvider> = {
  google: googleProvider,
  microsoft: microsoftProvider,
};

const providerParamSchema = z.object({
  provider: z.enum(["google", "microsoft"]),
});

export async function oauthRoutes(app: FastifyInstance) {
  // Initiation : renvoie l'URL d'autorisation du provider
  app.get("/oauth/:provider", async (request, reply) => {
    const { provider } = providerParamSchema.parse(request.params);

    const config = getProviderConfig(provider);
    if (!config || !config.clientId) {
      return reply.code(400).send({ error: `Provider ${provider} is not configured` });
    }

    const state = randomUUID();
    reply.setCookie(STATE_COOKIE, state, STATE_COOKIE_OPTIONS);

    const url = buildAuthorizationUrl(provider, state);
    return reply.send({ url });
  });

  // Callback : le provider redirige ici apres authentification
  app.get("/oauth/:provider/callback", async (request, reply) => {
    const { provider } = providerParamSchema.parse(request.params);

    const query = request.query as { code?: string; state?: string; error?: string };

    // Le provider a refuse l'acces
    if (query.error) {
      return reply.redirect(`${OAUTH_REDIRECT_URL}?error=oauth_denied`);
    }

    if (!query.code || !query.state) {
      return reply.redirect(`${OAUTH_REDIRECT_URL}?error=missing_params`);
    }

    // Verification CSRF
    const savedState = request.cookies?.[STATE_COOKIE];
    reply.clearCookie(STATE_COOKIE, { path: "/api/auth/oauth" });

    if (!savedState || savedState !== query.state) {
      return reply.redirect(`${OAUTH_REDIRECT_URL}?error=invalid_state`);
    }

    try {
      const providerImpl = providers[provider];
      const callbackUrl = buildCallbackUrl(provider);

      // Echange code -> access token provider
      const accessToken = await providerImpl.exchangeCode(query.code, callbackUrl);

      // Recup profil utilisateur
      const profile = await providerImpl.getUserProfile(accessToken);

      // Find or create user
      const result = await findOrCreateUserFromOAuth({
        provider,
        ...profile,
      });

      // Creer session NextQuest
      const refreshToken = await createSession(
        result.user.id,
        undefined,
        (request as any).ip,
        request.headers["user-agent"],
      );

      const jwtToken = app.jwt.sign(
        { sub: result.user.id, role: result.user.role },
        { expiresIn: "15m" },
      );

      reply.setCookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);

      // Redirige vers le front avec le token
      return reply.redirect(
        `${OAUTH_REDIRECT_URL}/auth/callback?token=${jwtToken}`,
      );
    } catch (err) {
      app.log.error(err, "OAuth callback failed");
      return reply.redirect(`${OAUTH_REDIRECT_URL}?error=oauth_failed`);
    }
  });

  // Lier un provider OAuth a un compte existant (authentifie)
  app.post(
    "/oauth/:provider/link",
    { onRequest: [async (req) => req.jwtVerify()] },
    async (request, reply) => {
      const { provider } = providerParamSchema.parse(request.params);

      const config = getProviderConfig(provider);
      if (!config || !config.clientId) {
        return reply.code(400).send({ error: `Provider ${provider} is not configured` });
      }

      const state = JSON.stringify({
        nonce: randomUUID(),
        action: "link",
        userId: (request.user as any).sub,
      });

      reply.setCookie(STATE_COOKIE, state, STATE_COOKIE_OPTIONS);

      const url = buildAuthorizationUrl(provider, state);
      return reply.send({ url });
    },
  );

  // Deliaison d'un provider (authentifie)
  app.delete(
    "/oauth/:provider/link",
    { onRequest: [async (req) => req.jwtVerify()] },
    async (request, reply) => {
      const { provider } = providerParamSchema.parse(request.params);
      const userId = (request.user as any).sub;

      try {
        await unlinkProviderFromUser(userId, provider);
        return reply.code(204).send();
      } catch (err: any) {
        if (err.message.includes("only login method")) {
          return reply.code(400).send({ error: err.message });
        }
        throw err;
      }
    },
  );
}

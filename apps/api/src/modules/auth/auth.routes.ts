import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { db, users } from "@nextquest/db";
import { eq } from "drizzle-orm";
import {
  registerSchema,
  loginSchema,
  restoreSchema,
  authTokensSchema,
  pendingDeletionSchema,
  RESTORE_TOKEN_PURPOSE,
} from "./auth.schemas.js";
import { userDTOSchema } from "../users/users.dto.js";
import { errorResponses, noContentSchema } from "../../lib/openapi.js";
import {
  createUser,
  verifyCredentials,
  createSession,
  rotateRefreshToken,
  revokeSession,
  revokeAllSessions,
  getUserById,
} from "./auth.service.js";
import {
  verifyPendingDeletionCredentials,
  purgeAfterOf,
  restoreAccount,
} from "../users/account-deletion.service.js";

// Cookie httpOnly + secure + sameSite strict = protection XSS + CSRF
const REFRESH_COOKIE = "refresh_token";
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api/auth",
  maxAge: 30 * 24 * 60 * 60, // 30 jours en secondes
};

// Cherche le refresh token dans le cookie d'abord, puis dans le body (fallback mobile)
function getRefreshToken(request: any): string | undefined {
  return request.cookies?.[REFRESH_COOKIE] || request.body?.refreshToken;
}

export async function authRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // Inscription : cree le user + session, renvoie access token + refresh token
  r.post("/auth/register", {
    // Anti-abus : limite la creation de comptes a 5 par IP par 15 min
    config: { rateLimit: { max: 5, timeWindow: "15 minutes" } },
    schema: {
      tags: ["Auth"],
      operationId: "register",
      summary: "Inscription email/mot de passe",
      description:
        "Cree un nouveau compte. Renvoie un access token JWT (15 min) et place le refresh token (30 jours) dans un cookie HttpOnly. Le refresh token est aussi renvoye dans le body pour le mobile.",
      body: registerSchema,
      response: {
        201: authTokensSchema,
        ...errorResponses(400, 409),
      },
    },
  }, async (request, reply) => {
    const input = request.body;

    let user;
    try {
      user = await createUser(input);
    } catch (err: any) {
      // Drizzle encapsule l'erreur postgres dans err.cause (ou directement sur err selon la version)
      const pgCode = err.code ?? err.cause?.code;
      if (pgCode === "23505") {
        return reply.code(409).send({ error: "Email ou username deja utilise" });
      }
      app.log.error(err);
      throw err;
    }
    // device_name = surnom court (varchar 100), pas l'UA brut. On laisse vide
    // tant qu'on n'a pas d'UI pour que le user nomme son appareil. L'UA complet
    // est stocke dans user_agent (text, taille libre).
    const refreshToken = await createSession(
      user.id,
      undefined,
      request.ip,
      request.headers["user-agent"],
    );

    const accessToken = app.jwt.sign(
      { sub: user.id, role: user.role },
      { expiresIn: "15m" },
    );

    reply.setCookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);

    return reply.code(201).send({
      user,
      accessToken,
      refreshToken,
    });
  });

  // Login : verifie les credentials, cree une nouvelle session
  r.post("/auth/login", {
    // Anti brute-force IP-based, en complement du verrouillage compte
    // (5 echecs / 15 min) gere dans verifyCredentials. 10 / min par IP.
    // Forme preHandler explicite (et non config.rateLimit) pour que les
    // analyseurs statiques type CodeQL reconnaissent le middleware.
    preHandler: app.rateLimit({ max: 10, timeWindow: "1 minute" }),
    schema: {
      tags: ["Auth"],
      operationId: "login",
      summary: "Connexion email/mot de passe",
      description:
        "Verifie les credentials, cree une session et renvoie access + refresh token. Apres 5 echecs, le compte est verrouille 15 minutes. Si le compte est en grace de suppression et le mot de passe correct, renvoie 403 avec un token de restauration.",
      body: loginSchema,
      response: {
        200: authTokensSchema,
        403: pendingDeletionSchema,
        ...errorResponses(400, 401),
      },
    },
  }, async (request, reply) => {
    const input = request.body;

    const user = await verifyCredentials(input.email, input.password);
    if (!user) {
      // Compte en grace de suppression ? On ne le revele QUE si le mot de
      // passe est correct (sinon reponse identique a un compte inexistant).
      // La verification porte la meme mecanique anti-brute-force que les
      // comptes actifs (compteur + verrou 15 min) -- voir le service.
      const pending = await verifyPendingDeletionCredentials(input.email, input.password);
      if (pending) {
        const restoreToken = app.jwt.sign(
          { sub: pending.id, purpose: RESTORE_TOKEN_PURPOSE },
          { expiresIn: "15m" },
        );
        return reply.code(403).send({
          error: "accountPendingDeletion" as const,
          deletedAt: pending.deletedAt.toISOString(),
          purgeAfter: purgeAfterOf(pending.deletedAt).toISOString(),
          restoreToken,
        });
      }
      return reply.code(401).send({ error: "Email ou mot de passe incorrect" });
    }

    // Voir commentaire identique dans /auth/register sur le choix d'undefined
    // pour deviceName.
    const refreshToken = await createSession(
      user.id,
      undefined,
      request.ip,
      request.headers["user-agent"],
    );

    const accessToken = app.jwt.sign(
      { sub: user.id, role: user.role },
      { expiresIn: "15m" },
    );

    reply.setCookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);

    return reply.send({
      user,
      accessToken,
      refreshToken,
    });
  });

  // Restauration d'un compte en grace de suppression. Le restore token (JWT
  // 15 min, purpose dedie) vaut preuve d'identite : il n'est emis qu'apres un
  // login valide (mdp correct) ou un OAuth reussi. Reconnecte completement.
  r.post(
    "/auth/restore",
    {
      // Anti-bruteforce du token : action rare, limite serree.
      config: { rateLimit: { max: 5, timeWindow: "15 minutes" } },
      schema: {
        tags: ["Auth"],
        operationId: "restoreAccount",
        summary: "Annule la suppression du compte pendant la grace",
        description:
          "Verifie le restore token (emis par le login 403 accountPendingDeletion ou le callback OAuth), annule le soft delete et ouvre une session complete. 410 si la grace est expiree ou le compte deja restaure/purge.",
        body: restoreSchema,
        response: {
          200: authTokensSchema,
          ...errorResponses(400, 401, 410, 429),
        },
      },
    },
    async (request, reply) => {
      let claims: { sub?: string; purpose?: string };
      try {
        claims = app.jwt.verify(request.body.restoreToken);
      } catch {
        return reply.code(401).send({ error: "Restore token invalide ou expire" });
      }
      if (claims.purpose !== RESTORE_TOKEN_PURPOSE || !claims.sub) {
        return reply.code(401).send({ error: "Restore token invalide ou expire" });
      }

      const outcome = await restoreAccount(claims.sub);
      if (outcome === "gone") {
        return reply.code(410).send({ error: "Grace expiree ou compte deja restaure" });
      }

      // Meme forme que le login (authUserSchema) : sous-ensemble du profil,
      // pas le UserDTO complet renvoye par getUserById. On requete les memes
      // colonnes que rotateRefreshToken pour ne pas dupliquer un mapping.
      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          username: users.username,
          displayName: users.displayName,
          locale: users.locale,
          role: users.role,
        })
        .from(users)
        .where(eq(users.id, claims.sub))
        .limit(1);
      if (!user) {
        return reply.code(410).send({ error: "Grace expiree ou compte deja restaure" });
      }

      const refreshToken = await createSession(
        claims.sub,
        undefined,
        request.ip,
        request.headers["user-agent"],
      );
      const accessToken = app.jwt.sign(
        { sub: claims.sub, role: user.role },
        { expiresIn: "15m" },
      );
      reply.setCookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);
      return reply.send({ user, accessToken, refreshToken });
    },
  );

  // Rotation du refresh token : l'ancien est invalide, un nouveau est emis
  app.post("/auth/refresh", {
    // Refresh legitime = 1 fois toutes les 15 min. 30 / min couvre les onglets
    // multiples sans laisser de marge pour le bruteforce.
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    schema: {
      tags: ["Auth"],
      operationId: "refreshToken",
      summary: "Renouveler l'access token",
      description:
        "Echange le refresh token (cookie ou body) contre un nouveau access token et un nouveau refresh token. Si un ancien refresh token deja revoque est reutilise, toute la famille est revoquee (detection de vol).",
      security: [{ cookieAuth: [] }],
      response: {
        200: authTokensSchema,
        ...errorResponses(401),
      },
    },
  }, async (request, reply) => {
    const oldToken = getRefreshToken(request);
    if (!oldToken) {
      return reply.code(401).send({ error: "Refresh token manquant" });
    }

    const result = await rotateRefreshToken(oldToken);
    if (!result) {
      reply.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
      return reply.code(401).send({ error: "Session invalide ou expiree" });
    }

    const accessToken = app.jwt.sign(
      { sub: result.user.id, role: result.user.role },
      { expiresIn: "15m" },
    );

    reply.setCookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS);

    return reply.send({
      user: result.user,
      accessToken,
      refreshToken: result.refreshToken,
    });
  });

  // Logout : revoque la session courante uniquement
  app.post("/auth/logout", {
    schema: {
      tags: ["Auth"],
      operationId: "logout",
      summary: "Deconnexion (session courante)",
      description:
        "Revoque le refresh token utilise et supprime le cookie. Les autres sessions restent actives.",
      security: [{ cookieAuth: [] }],
      response: {
        204: noContentSchema,
      },
    },
  }, async (request, reply) => {
    const token = getRefreshToken(request);
    if (token) {
      await revokeSession(token);
    }

    reply.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    return reply.code(204).send();
  });

  // Logout global : revoque TOUTES les sessions (utile si compte compromis)
  // Necessite un access token valide (contrairement au logout simple)
  app.post(
    "/auth/logout-all",
    {
      onRequest: [async (req) => req.jwtVerify()],
      schema: {
        tags: ["Auth"],
        operationId: "logoutAll",
        summary: "Deconnexion globale (toutes sessions)",
        description:
          "Revoque toutes les sessions de l'utilisateur. Utile en cas de compte compromis.",
        security: [{ bearerAuth: [] }],
        response: {
          204: noContentSchema,
          ...errorResponses(401),
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as any).sub;
      await revokeAllSessions(userId);

      reply.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
      return reply.code(204).send();
    },
  );

  // Profil du user connecte. Le front l'appelle apres OAuth ou apres refresh
  // de page pour afficher l'utilisateur (header, menu, etc.).
  app.get(
    "/auth/me",
    {
      onRequest: [async (req) => req.jwtVerify()],
      schema: {
        tags: ["Auth"],
        operationId: "getCurrentUser",
        summary: "Profil de l'utilisateur connecte",
        description:
          "Renvoie le profil public du user. A appeler apres OAuth ou apres un refresh de page.",
        security: [{ bearerAuth: [] }],
        response: {
          200: userDTOSchema,
          ...errorResponses(401, 404),
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as any).sub;
      const user = await getUserById(userId);

      if (!user) {
        // Le JWT est valide mais le user a ete supprime entre-temps : on revoque
        return reply.code(404).send({ error: "Utilisateur introuvable" });
      }

      return reply.send(user);
    },
  );
}

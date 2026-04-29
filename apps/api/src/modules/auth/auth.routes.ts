import type { FastifyInstance } from "fastify";
import { registerSchema, loginSchema } from "./auth.schemas.js";
import {
  createUser,
  verifyCredentials,
  createSession,
  rotateRefreshToken,
  revokeSession,
  revokeAllSessions,
  getUserById,
} from "./auth.service.js";

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
  // Inscription : cree le user + session, renvoie access token + refresh token
  app.post("/auth/register", {
    // Anti-abus : limite la creation de comptes a 5 par IP par 15 min
    config: { rateLimit: { max: 5, timeWindow: "15 minutes" } },
    schema: {
      tags: ["Auth"],
      summary: "Inscription email/mot de passe",
      description:
        "Cree un nouveau compte. Renvoie un access token JWT (15 min) et place le refresh token (30 jours) dans un cookie HttpOnly. Le refresh token est aussi renvoye dans le body pour le mobile.",
    },
  }, async (request, reply) => {
    const input = registerSchema.parse(request.body);

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
    const refreshToken = await createSession(
      user.id,
      request.headers["user-agent"],
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
  app.post("/auth/login", {
    // Anti brute-force IP-based, en complement du verrouillage compte
    // (5 echecs / 15 min) gere dans verifyCredentials. 10 / min par IP.
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    schema: {
      tags: ["Auth"],
      summary: "Connexion email/mot de passe",
      description:
        "Verifie les credentials, cree une session et renvoie access + refresh token. Apres 5 echecs, le compte est verrouille 15 minutes.",
    },
  }, async (request, reply) => {
    const input = loginSchema.parse(request.body);

    const user = await verifyCredentials(input.email, input.password);
    if (!user) {
      return reply.code(401).send({ error: "Email ou mot de passe incorrect" });
    }

    const refreshToken = await createSession(
      user.id,
      request.headers["user-agent"],
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

  // Rotation du refresh token : l'ancien est invalide, un nouveau est emis
  app.post("/auth/refresh", {
    // Refresh legitime = 1 fois toutes les 15 min. 30 / min couvre les onglets
    // multiples sans laisser de marge pour le bruteforce.
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    schema: {
      tags: ["Auth"],
      summary: "Renouveler l'access token",
      description:
        "Echange le refresh token (cookie ou body) contre un nouveau access token et un nouveau refresh token. Si un ancien refresh token deja revoque est reutilise, toute la famille est revoquee (detection de vol).",
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
      summary: "Deconnexion (session courante)",
      description:
        "Revoque le refresh token utilise et supprime le cookie. Les autres sessions restent actives.",
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
        summary: "Deconnexion globale (toutes sessions)",
        description:
          "Revoque toutes les sessions de l'utilisateur. Utile en cas de compte compromis.",
        security: [{ bearerAuth: [] }],
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
        summary: "Profil de l'utilisateur connecte",
        description:
          "Renvoie les infos publiques du user (id, email, username, displayName, avatarUrl, bio, locale, visibility, role, emailVerified, createdAt). A appeler apres OAuth ou apres un refresh de page.",
        security: [{ bearerAuth: [] }],
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

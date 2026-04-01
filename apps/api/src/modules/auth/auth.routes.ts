import type { FastifyInstance } from "fastify";
import { registerSchema, loginSchema } from "./auth.schemas.js";
import {
  createUser,
  verifyCredentials,
  createSession,
  rotateRefreshToken,
  revokeSession,
  revokeAllSessions,
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
  app.post("/auth/register", async (request, reply) => {
    const input = registerSchema.parse(request.body);

    let user;
    try {
      user = await createUser(input);
    } catch (err: any) {
      if (err.code === "23505") {
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
  app.post("/auth/login", async (request, reply) => {
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
  app.post("/auth/refresh", async (request, reply) => {
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
  app.post("/auth/logout", async (request, reply) => {
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
    { onRequest: [async (req) => req.jwtVerify()] },
    async (request, reply) => {
      const userId = (request.user as any).sub;
      await revokeAllSessions(userId);

      reply.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
      return reply.code(204).send();
    },
  );
}

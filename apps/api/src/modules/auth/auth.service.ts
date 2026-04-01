import { hash, verify } from "argon2";
import { randomUUID, createHash } from "node:crypto";
import { db, users, sessions } from "@nextquest/db";
import { eq, and, isNull } from "drizzle-orm";
import type { RegisterInput } from "./auth.schemas.js";

// Config Argon2id recommandee par OWASP
// memoryCost en KiB (64 Mo), timeCost = iterations, parallelism = threads
const ARGON2_OPTIONS = {
  type: 2 as const, // argon2id combine les resistances d'argon2i (side-channel) et argon2d (GPU)
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

// On stocke le hash SHA-256 des tokens, jamais le token brut
// Comme ca meme si la BDD fuite, les tokens sont inutilisables
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createUser(input: RegisterInput) {
  const passwordHash = await hash(input.password, ARGON2_OPTIONS);

  const [user] = await db
    .insert(users)
    .values({
      email: input.email,
      username: input.username,
      passwordHash,
      displayName: input.displayName ?? null,
      locale: input.locale ?? "fr",
    })
    .returning({
      id: users.id,
      email: users.email,
      username: users.username,
      displayName: users.displayName,
      locale: users.locale,
      role: users.role,
    });

  return user;
}

export async function verifyCredentials(email: string, password: string) {
  // On filtre les comptes supprimes (soft delete RGPD)
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1);

  if (!user || !user.passwordHash) return null;

  // Compte verrouille apres trop de tentatives
  if (user.lockedUntil && user.lockedUntil > new Date()) return null;

  const valid = await verify(user.passwordHash, password);

  if (!valid) {
    // Incrementer le compteur d'echecs, verrouiller apres 5 tentatives (15 min)
    const attempts = (user.failedLoginAttempts ?? 0) + 1;
    await db
      .update(users)
      .set({
        failedLoginAttempts: attempts,
        lockedUntil: attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
      })
      .where(eq(users.id, user.id));
    return null;
  }

  // Login reussi : reset du compteur
  if (user.failedLoginAttempts && user.failedLoginAttempts > 0) {
    await db
      .update(users)
      .set({ failedLoginAttempts: 0, lockedUntil: null })
      .where(eq(users.id, user.id));
  }

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    locale: user.locale,
    role: user.role,
  };
}

// Cree une session en BDD avec le hash du refresh token
// Le familyId relie les tokens d'une meme chaine de rotation
export async function createSession(
  userId: string,
  deviceName?: string,
  ipAddress?: string,
  userAgent?: string,
) {
  // Double UUID pour un token suffisamment long et imprevisible
  const refreshToken = randomUUID() + "-" + randomUUID();
  const refreshTokenHash = hashToken(refreshToken);
  const familyId = randomUUID();

  await db.insert(sessions).values({
    userId,
    refreshTokenHash,
    familyId,
    generation: 1,
    deviceName,
    ipAddress,
    userAgent,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  // On renvoie le token brut au client, jamais le hash
  return refreshToken;
}

// Rotation : l'ancien refresh token est revoque, un nouveau est cree
// Si un token deja revoque est reutilise, c'est un vol : on revoque toute la famille
export async function rotateRefreshToken(oldRefreshToken: string) {
  const oldHash = hashToken(oldRefreshToken);

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.refreshTokenHash, oldHash))
    .limit(1);

  if (!session) return null;

  if (session.revokedAt || session.expiresAt < new Date()) {
    // Detection de vol : si le token est deja revoque mais reutilise,
    // quelqu'un a vole l'ancien token => on revoque TOUTE la famille
    if (!session.revokedAt) {
      await db
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(eq(sessions.familyId, session.familyId));
    }
    return null;
  }

  // Revoquer l'ancien
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.id, session.id));

  // Nouveau token dans la meme famille, generation incrementee
  const newRefreshToken = randomUUID() + "-" + randomUUID();
  const newHash = hashToken(newRefreshToken);

  await db.insert(sessions).values({
    userId: session.userId,
    refreshTokenHash: newHash,
    familyId: session.familyId,
    generation: session.generation + 1,
    deviceName: session.deviceName,
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

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
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user) return null;

  return { user, refreshToken: newRefreshToken };
}

export async function revokeSession(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.refreshTokenHash, tokenHash));
}

// Deconnexion de tous les appareils
export async function revokeAllSessions(userId: string) {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.userId, userId));
}

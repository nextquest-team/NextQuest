import { randomUUID } from "node:crypto";
import { db, users, authProviders } from "@nextquest/db";
import { eq, and, ne } from "drizzle-orm";
import type { OAuthUserProfile } from "./providers/types.js";
import { generateDefaultAvatar } from "../../users/default-avatar.service.js";

interface OAuthResult {
  user: {
    id: string;
    email: string;
    username: string;
    displayName: string | null;
    locale: string;
    role: string;
  };
  isNewUser: boolean;
}

// Generates a unique username from email or displayName
function generateUsername(email: string, displayName: string | null): string {
  // Cas observe : Microsoft renvoie un displayName non-null mais qui ne contient
  // que des caracteres non-alphanumeriques (ex: ideogrammes, ponctuation seule).
  // Apres sanitization, ca donne une chaine vide -> fallback sur l'email.
  const fromDisplayName = displayName
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const fromEmail = email.split("@")[0].replace(/[^a-z0-9]/g, "");
  const base = fromDisplayName || fromEmail;
  const truncated = base.slice(0, 24) || "user";
  const suffix = randomUUID().slice(0, 5);
  return `${truncated}_${suffix}`;
}

const USER_SELECT = {
  id: users.id,
  email: users.email,
  username: users.username,
  displayName: users.displayName,
  locale: users.locale,
  role: users.role,
};

export async function findOrCreateUserFromOAuth(
  profile: OAuthUserProfile & { provider: string },
): Promise<OAuthResult> {
  // 1. Is provider already linked?
  const [existingProvider] = await db
    .select({ userId: authProviders.userId })
    .from(authProviders)
    .where(
      and(
        eq(authProviders.provider, profile.provider),
        eq(authProviders.providerId, profile.providerId),
      ),
    )
    .limit(1);

  if (existingProvider) {
    const [user] = await db
      .select(USER_SELECT)
      .from(users)
      .where(eq(users.id, existingProvider.userId))
      .limit(1);
    return { user: user!, isNewUser: false };
  }

  // 2. Does email already exist?
  const [existingUser] = await db
    .select(USER_SELECT)
    .from(users)
    .where(eq(users.email, profile.email))
    .limit(1);

  if (existingUser) {
    await db.insert(authProviders).values({
      userId: existingUser.id,
      provider: profile.provider,
      providerId: profile.providerId,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
    });
    return { user: existingUser, isNewUser: false };
  }

  // 3. Create a new user
  const username = generateUsername(profile.email, profile.displayName);

  const [newUser] = await db
    .insert(users)
    .values({
      email: profile.email,
      username,
      passwordHash: null,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    })
    .returning(USER_SELECT);

  await db.insert(authProviders).values({
    userId: newUser!.id,
    provider: profile.provider,
    providerId: profile.providerId,
    email: profile.email,
    avatarUrl: profile.avatarUrl,
  });

  // Avatar de repli uniquement si le provider n'en fournit pas deja un
  // (Google/Microsoft renvoient generalement une vraie photo de profil).
  // Best-effort : ne bloque jamais la creation de compte.
  if (!profile.avatarUrl) {
    try {
      const avatarUrl = await generateDefaultAvatar(
        newUser!.id,
        newUser!.displayName ?? newUser!.username,
      );
      await db.update(users).set({ avatarUrl }).where(eq(users.id, newUser!.id));
    } catch {
      // ignore : voir commentaire ci-dessus
    }
  }

  return { user: newUser!, isNewUser: true };
}

export async function linkProviderToUser(
  userId: string,
  profile: {
    provider: string;
    providerId: string;
    email: string;
    avatarUrl: string | null;
  },
): Promise<void> {
  const [existing] = await db
    .select({ userId: authProviders.userId })
    .from(authProviders)
    .where(
      and(
        eq(authProviders.provider, profile.provider),
        eq(authProviders.providerId, profile.providerId),
      ),
    )
    .limit(1);

  if (existing) {
    throw new Error(`This ${profile.provider} account is already linked to another user`);
  }

  try {
    await db.insert(authProviders).values({
      userId,
      provider: profile.provider,
      providerId: profile.providerId,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
    });
  } catch (err: any) {
    const pgCode = err.code ?? err.cause?.code;
    if (pgCode === "23505") {
      throw new Error(`Provider ${profile.provider} is already linked to this account`);
    }
    throw err;
  }
}

export async function unlinkProviderFromUser(
  userId: string,
  provider: string,
): Promise<void> {
  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const otherProviders = await db
    .select({ id: authProviders.id })
    .from(authProviders)
    .where(and(eq(authProviders.userId, userId), ne(authProviders.provider, provider)));

  const hasPassword = user?.passwordHash !== null;
  const hasOtherProviders = otherProviders.length > 0;

  if (!hasPassword && !hasOtherProviders) {
    throw new Error("Cannot unlink: this is your only login method");
  }

  await db
    .delete(authProviders)
    .where(and(eq(authProviders.userId, userId), eq(authProviders.provider, provider)));
}

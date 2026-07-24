import { describe, it, expect, beforeEach } from "vitest";
import { db, users, authProviders, sessions } from "@nextquest/db";
import { eq } from "drizzle-orm";
import {
  findOrCreateUserFromOAuth,
  linkProviderToUser,
  unlinkProviderFromUser,
} from "../oauth.service.js";
import { softDeleteAccount } from "../../../users/account-deletion.service.js";

async function cleanup() {
  await db.delete(sessions);
  await db.delete(authProviders);
  await db.delete(users);
}

async function createTestUser(
  overrides: Partial<typeof users.$inferInsert> = {},
) {
  const [user] = await db
    .insert(users)
    .values({
      email: "test@example.com",
      username: "testuser",
      passwordHash: "$argon2id$placeholder",
      ...overrides,
    })
    .returning();
  return user!;
}

describe("findOrCreateUserFromOAuth", () => {
  beforeEach(cleanup);

  it("creates a new user when no match exists", async () => {
    const result = await findOrCreateUserFromOAuth({
      provider: "google",
      providerId: "google-123",
      email: "new@example.com",
      displayName: "New User",
      avatarUrl: "https://example.com/avatar.jpg",
    });

    expect(result.user.email).toBe("new@example.com");
    expect(result.user.username).toBeTruthy();
    expect(result.isNewUser).toBe(true);

    const [ap] = await db
      .select()
      .from(authProviders)
      .where(eq(authProviders.userId, result.user.id));
    expect(ap.provider).toBe("google");
    expect(ap.providerId).toBe("google-123");
  });

  it("logs in existing user when provider already linked", async () => {
    const user = await createTestUser({
      email: "existing@example.com",
      username: "existing",
    });
    await db.insert(authProviders).values({
      userId: user.id,
      provider: "google",
      providerId: "google-456",
      email: "existing@example.com",
    });

    const result = await findOrCreateUserFromOAuth({
      provider: "google",
      providerId: "google-456",
      email: "existing@example.com",
      displayName: null,
      avatarUrl: null,
    });

    expect(result.user.id).toBe(user.id);
    expect(result.isNewUser).toBe(false);
  });

  it("links provider to existing user with same email", async () => {
    const user = await createTestUser({
      email: "same@example.com",
      username: "sameuser",
    });

    const result = await findOrCreateUserFromOAuth({
      provider: "google",
      providerId: "google-789",
      email: "same@example.com",
      displayName: null,
      avatarUrl: null,
    });

    expect(result.user.id).toBe(user.id);
    expect(result.isNewUser).toBe(false);

    const [ap] = await db
      .select()
      .from(authProviders)
      .where(eq(authProviders.userId, user.id));
    expect(ap.provider).toBe("google");
  });

  it("signale un compte en grace quand le provider est deja lie", async () => {
    const user = await createTestUser({
      email: "linked-pending@example.com",
      username: "linkedpending",
    });
    await db.insert(authProviders).values({
      userId: user.id,
      provider: "google",
      providerId: "google-pending-1",
      email: "linked-pending@example.com",
    });
    await softDeleteAccount(user.id);

    const result = await findOrCreateUserFromOAuth({
      provider: "google",
      providerId: "google-pending-1",
      email: "linked-pending@example.com",
      displayName: null,
      avatarUrl: null,
    });

    expect("pendingDeletion" in result).toBe(true);
    if ("pendingDeletion" in result) {
      expect(result.pendingDeletion.userId).toBe(user.id);
      expect(result.pendingDeletion.deletedAt).toBeInstanceOf(Date);
    }
  });

  it("signale un compte en grace via l'email meme sans provider lie (pas d'insert)", async () => {
    const user = await createTestUser({
      email: "email-pending@example.com",
      username: "emailpending",
    });
    await softDeleteAccount(user.id);

    const result = await findOrCreateUserFromOAuth({
      provider: "google",
      providerId: "google-pending-2",
      email: "email-pending@example.com",
      displayName: null,
      avatarUrl: null,
    });

    expect("pendingDeletion" in result).toBe(true);
    if ("pendingDeletion" in result) {
      expect(result.pendingDeletion.userId).toBe(user.id);
    }

    // Ni lien de provider, ni nouveau compte : la ligne existante reste seule.
    const providers = await db
      .select()
      .from(authProviders)
      .where(eq(authProviders.userId, user.id));
    expect(providers).toHaveLength(0);
    const matchingUsers = await db
      .select()
      .from(users)
      .where(eq(users.email, "email-pending@example.com"));
    expect(matchingUsers).toHaveLength(1);
  });

  it("grace expiree mais ligne pas encore purgee : cas limite accepte, l'INSERT collisionne en 23505", async () => {
    // Ni le lookup provider ni l'email ne matchent plus (les finders filtrent
    // sur la grace) : le flux tente de creer un nouveau compte, qui entre en
    // collision avec la ligne soft-deleted tant que le job de purge n'est pas
    // passe. Fenetre 0-30 jours documentee et acceptee -- voir oauth.routes.ts
    // (le callback attrape l'erreur et redirige oauth_failed).
    const user = await createTestUser({
      email: "expired-pending@example.com",
      username: "expiredpending",
    });
    await softDeleteAccount(user.id);
    await db
      .update(users)
      .set({ deletedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) })
      .where(eq(users.id, user.id));

    await expect(
      findOrCreateUserFromOAuth({
        provider: "google",
        providerId: "google-expired-1",
        email: "expired-pending@example.com",
        displayName: null,
        avatarUrl: null,
      }),
    ).rejects.toThrow();
  });

  it("un lien provider vers un compte hors grace ne reconnecte JAMAIS (symetrie avec le login mdp)", async () => {
    // Le lien auth_providers existe encore, mais le compte est soft-deleted
    // et la grace est expiree : le lookup provider ne doit pas rendre de
    // session. Le flux retombe sur le chemin email -> collision 23505, comme
    // le cas precedent. Sans le filtre isNull(deleted_at), ce test rendrait
    // un user connecte.
    const user = await createTestUser({
      email: "expired-linked@example.com",
      username: "expiredlinked",
    });
    await db.insert(authProviders).values({
      userId: user.id,
      provider: "google",
      providerId: "google-expired-linked-1",
    });
    await softDeleteAccount(user.id);
    await db
      .update(users)
      .set({ deletedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) })
      .where(eq(users.id, user.id));

    await expect(
      findOrCreateUserFromOAuth({
        provider: "google",
        providerId: "google-expired-linked-1",
        email: "expired-linked@example.com",
        displayName: null,
        avatarUrl: null,
      }),
    ).rejects.toThrow();
  });
});

describe("linkProviderToUser", () => {
  beforeEach(cleanup);

  it("links a new provider to an existing user", async () => {
    const user = await createTestUser();

    await linkProviderToUser(user.id, {
      provider: "microsoft",
      providerId: "ms-123",
      email: "test@outlook.com",
      avatarUrl: null,
    });

    const [ap] = await db
      .select()
      .from(authProviders)
      .where(eq(authProviders.userId, user.id));
    expect(ap.provider).toBe("microsoft");
  });

  it("throws if provider already linked to another user", async () => {
    const user1 = await createTestUser({
      email: "u1@test.com",
      username: "user1",
    });
    const user2 = await createTestUser({
      email: "u2@test.com",
      username: "user2",
    });

    await linkProviderToUser(user1.id, {
      provider: "google",
      providerId: "g-shared",
      email: "u1@test.com",
      avatarUrl: null,
    });

    await expect(
      linkProviderToUser(user2.id, {
        provider: "google",
        providerId: "g-shared",
        email: "u2@test.com",
        avatarUrl: null,
      }),
    ).rejects.toThrow("already linked");
  });
});

describe("unlinkProviderFromUser", () => {
  beforeEach(cleanup);

  it("unlinks a provider when user has a password", async () => {
    const user = await createTestUser();
    await db.insert(authProviders).values({
      userId: user.id,
      provider: "google",
      providerId: "g-111",
      email: "test@example.com",
    });

    await unlinkProviderFromUser(user.id, "google");

    const providers = await db
      .select()
      .from(authProviders)
      .where(eq(authProviders.userId, user.id));
    expect(providers).toHaveLength(0);
  });

  it("refuses to unlink if it is the only login method", async () => {
    const user = await createTestUser({ passwordHash: null });
    await db.insert(authProviders).values({
      userId: user.id,
      provider: "google",
      providerId: "g-222",
      email: "test@example.com",
    });

    await expect(unlinkProviderFromUser(user.id, "google")).rejects.toThrow(
      "only login method",
    );
  });

  it("allows unlink if user has another provider", async () => {
    const user = await createTestUser({ passwordHash: null });
    await db.insert(authProviders).values([
      {
        userId: user.id,
        provider: "google",
        providerId: "g-333",
        email: "t@test.com",
      },
      {
        userId: user.id,
        provider: "microsoft",
        providerId: "ms-333",
        email: "t@test.com",
      },
    ]);

    await unlinkProviderFromUser(user.id, "google");

    const providers = await db
      .select()
      .from(authProviders)
      .where(eq(authProviders.userId, user.id));
    expect(providers).toHaveLength(1);
    expect(providers[0].provider).toBe("microsoft");
  });
});

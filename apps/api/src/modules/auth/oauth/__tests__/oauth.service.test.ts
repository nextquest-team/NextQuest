import { describe, it, expect, beforeEach } from "vitest";
import { db, users, authProviders, sessions } from "@nextquest/db";
import { eq } from "drizzle-orm";
import {
  findOrCreateUserFromOAuth,
  linkProviderToUser,
  unlinkProviderFromUser,
} from "../oauth.service.js";

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

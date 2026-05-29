import { describe, it, expect, beforeEach } from "vitest";
import { db, users, sessions, authProviders } from "@nextquest/db";
import { eq } from "drizzle-orm";
import {
  getUserById,
  updateProfile,
  completeOnboarding,
} from "../users.service.js";

async function cleanup() {
  await db.delete(sessions);
  await db.delete(authProviders);
  await db.delete(users);
}

async function createTestUser(overrides: Partial<typeof users.$inferInsert> = {}) {
  const [user] = await db
    .insert(users)
    .values({
      email: `u-${Date.now()}-${Math.random()}@test.com`,
      username: `user${Date.now()}${Math.floor(Math.random() * 1000)}`,
      passwordHash: "argon2id$dummy",
      ...overrides,
    })
    .returning();
  return user;
}

describe("getUserById", () => {
  beforeEach(cleanup);

  it("retourne un DTO pour un user existant", async () => {
    const user = await createTestUser({ displayName: "Jean" });
    const dto = await getUserById(user.id);
    expect(dto).not.toBeNull();
    expect(dto?.id).toBe(user.id);
    expect(dto?.displayName).toBe("Jean");
    expect(dto?.onboardingCompleted).toBe(false);
  });

  it("retourne null pour un user inexistant", async () => {
    const dto = await getUserById("00000000-0000-0000-0000-000000000000");
    expect(dto).toBeNull();
  });

  it("retourne null pour un user soft-deleted", async () => {
    const user = await createTestUser({ deletedAt: new Date() });
    const dto = await getUserById(user.id);
    expect(dto).toBeNull();
  });

  it("ne contient JAMAIS passwordHash", async () => {
    const user = await createTestUser();
    const dto = (await getUserById(user.id)) as Record<string, unknown> | null;
    expect(dto).not.toBeNull();
    expect(dto?.passwordHash).toBeUndefined();
  });
});

describe("updateProfile", () => {
  beforeEach(cleanup);

  it("met a jour seulement les champs fournis", async () => {
    const user = await createTestUser({
      displayName: "Avant",
      bio: "Ancienne bio",
    });
    const dto = await updateProfile(user.id, { displayName: "Apres" });
    expect(dto.displayName).toBe("Apres");
    expect(dto.bio).toBe("Ancienne bio");
  });

  it("accepte plusieurs champs", async () => {
    const user = await createTestUser();
    const dto = await updateProfile(user.id, {
      displayName: "Nouveau",
      bio: "Nouvelle bio",
      locale: "en",
      visibility: "private",
    });
    expect(dto.displayName).toBe("Nouveau");
    expect(dto.bio).toBe("Nouvelle bio");
    expect(dto.locale).toBe("en");
    expect(dto.visibility).toBe("private");
  });

  it("throw pour un user inexistant", async () => {
    await expect(
      updateProfile("00000000-0000-0000-0000-000000000000", { displayName: "X" }),
    ).rejects.toThrow();
  });

  it("throw pour un user soft-deleted", async () => {
    const user = await createTestUser({ deletedAt: new Date() });
    await expect(
      updateProfile(user.id, { displayName: "X" }),
    ).rejects.toThrow();
  });
});

describe("completeOnboarding", () => {
  beforeEach(cleanup);

  it("passe le flag a true", async () => {
    const user = await createTestUser();
    expect(user.onboardingCompleted).toBe(false);

    const result = await completeOnboarding(user.id);
    expect(result).toEqual({ onboardingCompleted: true });

    const [updated] = await db.select().from(users).where(eq(users.id, user.id));
    expect(updated.onboardingCompleted).toBe(true);
  });

  it("est idempotent (deux appels successifs)", async () => {
    const user = await createTestUser();
    await completeOnboarding(user.id);
    const result = await completeOnboarding(user.id);
    expect(result).toEqual({ onboardingCompleted: true });
  });

  it("throw pour un user inexistant", async () => {
    await expect(
      completeOnboarding("00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow();
  });
});

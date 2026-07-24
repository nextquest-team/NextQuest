import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db, users, sessions, gdprRequests } from "@nextquest/db";
import { eq, and, isNotNull } from "drizzle-orm";
import {
  softDeleteAccount,
  findPendingDeletionByEmail,
  findPendingDeletionById,
  restoreAccount,
  accountPurgeGraceDays,
  purgeAfterOf,
} from "../account-deletion.service.js";

async function createTestUser(overrides: Record<string, unknown> = {}) {
  const [user] = await db
    .insert(users)
    .values({
      email: `del-${Date.now()}-${Math.random()}@test.com`,
      username: `del${Date.now()}${Math.floor(Math.random() * 1000)}`,
      passwordHash: "argon2id$dummy",
      ...overrides,
    })
    .returning();
  return user;
}

beforeEach(async () => {
  await db.delete(gdprRequests);
  await db.delete(sessions);
  await db.delete(users);
});

afterEach(() => {
  delete process.env.ACCOUNT_PURGE_GRACE_DAYS;
});

describe("accountPurgeGraceDays / purgeAfterOf", () => {
  it("defaut 30 jours, surchargeable par env a l'appel", () => {
    expect(accountPurgeGraceDays()).toBe(30);
    process.env.ACCOUNT_PURGE_GRACE_DAYS = "7";
    expect(accountPurgeGraceDays()).toBe(7);
    const d = new Date("2026-07-24T10:00:00Z");
    expect(purgeAfterOf(d).toISOString()).toBe("2026-07-31T10:00:00.000Z");
  });
});

describe("softDeleteAccount", () => {
  it("pose deleted_at, revoque TOUTES les sessions, cree la demande gdpr", async () => {
    const user = await createTestUser();
    await db.insert(sessions).values([
      { userId: user.id, refreshTokenHash: `h1-${user.id}`, familyId: crypto.randomUUID(), expiresAt: new Date(Date.now() + 86400000) },
      { userId: user.id, refreshTokenHash: `h2-${user.id}`, familyId: crypto.randomUUID(), expiresAt: new Date(Date.now() + 86400000) },
    ]);

    const result = await softDeleteAccount(user.id);

    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row.deletedAt).not.toBeNull();
    expect(result.purgeAfter.getTime()).toBe(purgeAfterOf(result.deletedAt).getTime());

    const openSessions = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, user.id), isNotNull(sessions.revokedAt)));
    expect(openSessions).toHaveLength(2);

    const requests = await db.select().from(gdprRequests).where(eq(gdprRequests.userId, user.id));
    expect(requests).toHaveLength(1);
    expect(requests[0].type).toBe("erasure");
    expect(requests[0].status).toBe("pending");
  });

  it("idempotent : un second appel renvoie le meme purgeAfter sans nouvelle ligne gdpr", async () => {
    const user = await createTestUser();
    const first = await softDeleteAccount(user.id);
    const second = await softDeleteAccount(user.id);
    expect(second.deletedAt.getTime()).toBe(first.deletedAt.getTime());
    const requests = await db.select().from(gdprRequests).where(eq(gdprRequests.userId, user.id));
    expect(requests).toHaveLength(1);
  });
});

describe("findPendingDeletionByEmail", () => {
  it("trouve un compte en grace, ignore les comptes actifs et les graces expirees", async () => {
    const active = await createTestUser();
    expect(await findPendingDeletionByEmail(active.email)).toBeNull();

    const pending = await createTestUser();
    await softDeleteAccount(pending.id);
    const found = await findPendingDeletionByEmail(pending.email);
    expect(found?.id).toBe(pending.id);

    const expired = await createTestUser();
    await db.update(users).set({ deletedAt: new Date(Date.now() - 31 * 86400000) }).where(eq(users.id, expired.id));
    expect(await findPendingDeletionByEmail(expired.email)).toBeNull();
  });
});

describe("findPendingDeletionById", () => {
  it("meme semantique que la variante email : grace en cours uniquement", async () => {
    const active = await createTestUser();
    expect(await findPendingDeletionById(active.id)).toBeNull();

    const pending = await createTestUser();
    await softDeleteAccount(pending.id);
    expect((await findPendingDeletionById(pending.id))?.id).toBe(pending.id);

    await db.update(users).set({ deletedAt: new Date(Date.now() - 31 * 86400000) }).where(eq(users.id, pending.id));
    expect(await findPendingDeletionById(pending.id)).toBeNull();
  });
});

describe("restoreAccount", () => {
  it("annule le soft delete et passe la demande gdpr en rejected", async () => {
    const user = await createTestUser();
    await softDeleteAccount(user.id);

    expect(await restoreAccount(user.id)).toBe("restored");

    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row.deletedAt).toBeNull();
    const [req] = await db.select().from(gdprRequests).where(eq(gdprRequests.userId, user.id));
    expect(req.status).toBe("rejected");
    expect(req.processedAt).not.toBeNull();
  });

  it("gone si la grace est expiree ou le compte deja actif", async () => {
    const user = await createTestUser();
    await db.update(users).set({ deletedAt: new Date(Date.now() - 31 * 86400000) }).where(eq(users.id, user.id));
    expect(await restoreAccount(user.id)).toBe("gone");

    const active = await createTestUser();
    expect(await restoreAccount(active.id)).toBe("gone");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { db, users, gdprRequests, sessions } from "@nextquest/db";
import { eq, isNull } from "drizzle-orm";

vi.mock("../../../lib/storage.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/storage.js")>();
  return { ...actual, purgeUserStorage: vi.fn(async () => undefined) };
});

import { purgeUserStorage, StorageError } from "../../../lib/storage.js";
import { purgeExpiredAccounts } from "../purge.service.js";
import { softDeleteAccount } from "../account-deletion.service.js";

// Meme fabrique que les autres fichiers du dossier : email/username uniques,
// hash bidon (jamais verifie dans ces tests).
async function createTestUser(overrides: Record<string, unknown> = {}) {
  const [user] = await db
    .insert(users)
    .values({
      email: `purge-${Date.now()}-${Math.random()}@test.com`,
      username: `purge${Date.now()}${Math.floor(Math.random() * 1000)}`,
      passwordHash: "argon2id$dummy",
      ...overrides,
    })
    .returning();
  return user;
}

beforeEach(async () => {
  vi.clearAllMocks();
  await db.delete(gdprRequests);
  await db.delete(sessions);
  await db.delete(users);
});

describe("purgeExpiredAccounts", () => {
  it("purge les comptes echus : storage d'abord, gdpr completed, puis DELETE cascade", async () => {
    const user = await createTestUser();
    await softDeleteAccount(user.id);
    await db.update(users).set({ deletedAt: new Date(Date.now() - 31 * 86400000) }).where(eq(users.id, user.id));

    const summary = await purgeExpiredAccounts();

    expect(summary).toEqual({ purged: 1, skipped: 0 });
    expect(purgeUserStorage).toHaveBeenCalledWith(user.id);
    expect(await db.select().from(users).where(eq(users.id, user.id))).toHaveLength(0);
    // La trace gdpr survit avec user_id passe a null (SET NULL) et statut completed
    const traces = await db.select().from(gdprRequests).where(isNull(gdprRequests.userId));
    expect(traces).toHaveLength(1);
    expect(traces[0].status).toBe("completed");
    expect(traces[0].processedAt).not.toBeNull();
  });

  it("ne touche pas aux comptes encore en grace ni aux comptes actifs", async () => {
    const active = await createTestUser();
    const inGrace = await createTestUser();
    await softDeleteAccount(inGrace.id);

    const summary = await purgeExpiredAccounts();

    expect(summary).toEqual({ purged: 0, skipped: 0 });
    expect(await db.select().from(users)).toHaveLength(2);
    expect(purgeUserStorage).not.toHaveBeenCalled();
  });

  it("skip (et conserve) un compte dont la purge storage echoue", async () => {
    const user = await createTestUser();
    await softDeleteAccount(user.id);
    await db.update(users).set({ deletedAt: new Date(Date.now() - 31 * 86400000) }).where(eq(users.id, user.id));
    vi.mocked(purgeUserStorage).mockRejectedValueOnce(new StorageError("minio down"));

    const summary = await purgeExpiredAccounts();

    expect(summary).toEqual({ purged: 0, skipped: 1 });
    expect(await db.select().from(users).where(eq(users.id, user.id))).toHaveLength(1);
    const [req] = await db.select().from(gdprRequests).where(eq(gdprRequests.userId, user.id));
    expect(req.status).toBe("pending"); // rien n'a bouge, retente au prochain run
  });
});

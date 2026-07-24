import type { FastifyBaseLogger } from "fastify";
import { db, users, gdprRequests } from "@nextquest/db";
import { and, eq, lt, isNotNull, inArray } from "drizzle-orm";
import { purgeUserStorage } from "../../lib/storage.js";
import { accountPurgeGraceDays } from "./account-deletion.service.js";

export type PurgeSummary = { purged: number; skipped: number };

// Hard delete RGPD des comptes dont la grace est ecoulee. Ordre impose :
// le bucket d'abord (la cascade Postgres ne l'atteint pas), la trace gdpr
// ensuite (le DELETE la passerait en user_id null avant qu'on la retrouve),
// le DELETE FROM users en dernier (cascades BDD = promesse du CLAUDE.md).
export async function purgeExpiredAccounts(log?: FastifyBaseLogger): Promise<PurgeSummary> {
  const cutoff = new Date(Date.now() - accountPurgeGraceDays() * 24 * 60 * 60 * 1000);
  const expired = await db
    .select({ id: users.id })
    .from(users)
    .where(and(isNotNull(users.deletedAt), lt(users.deletedAt, cutoff)));

  let purged = 0;
  let skipped = 0;
  for (const { id } of expired) {
    try {
      await purgeUserStorage(id);
    } catch (err) {
      // Storage injoignable : on ne purge PAS la BDD sans le bucket. Le compte
      // reste en grace prolongee et sera retente au prochain run quotidien.
      log?.warn({ err, userId: id }, "purge comptes : storage indisponible, compte saute");
      skipped++;
      continue;
    }
    await db
      .update(gdprRequests)
      .set({ status: "completed", processedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(gdprRequests.userId, id),
          eq(gdprRequests.type, "erasure"),
          inArray(gdprRequests.status, ["pending", "processing"]),
        ),
      );
    await db.delete(users).where(eq(users.id, id));
    purged++;
  }
  return { purged, skipped };
}

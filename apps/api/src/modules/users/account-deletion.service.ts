import { db, users, sessions, gdprRequests } from "@nextquest/db";
import { and, eq, gt, isNull, isNotNull, inArray } from "drizzle-orm";

// Grace lue a l'appel (pas a l'import) : les tests la font varier, et un
// changement d'env ne doit pas exiger un redemarrage pour la purge.
export function accountPurgeGraceDays(): number {
  // Chaine vide traitee comme absente : Number("") vaudrait 0 et raccourcirait
  // silencieusement la grace a zero jour.
  const rawStr = process.env.ACCOUNT_PURGE_GRACE_DAYS;
  if (!rawStr) return 30;
  const raw = Number(rawStr);
  return Number.isInteger(raw) && raw >= 0 ? raw : 30;
}

export function purgeAfterOf(deletedAt: Date): Date {
  return new Date(deletedAt.getTime() + accountPurgeGraceDays() * 24 * 60 * 60 * 1000);
}

function graceCutoff(): Date {
  return new Date(Date.now() - accountPurgeGraceDays() * 24 * 60 * 60 * 1000);
}

// Soft delete transactionnel : le compte devient invisible (guards deleted_at
// existants), toutes les sessions tombent, la demande RGPD trace l'evenement.
// Idempotent : re-supprimer un compte deja en grace renvoie le meme purgeAfter
// sans dupliquer la demande gdpr.
export async function softDeleteAccount(
  userId: string,
): Promise<{ deletedAt: Date; purgeAfter: Date }> {
  return db.transaction(async (tx) => {
    const deletedAt = new Date();
    // UPDATE conditionnel atomique (meme pattern que restoreAccount) : sous
    // READ COMMITTED, deux appels concurrents ne peuvent pas tous deux passer
    // le WHERE deleted_at IS NULL — un seul insere la demande gdpr, l'autre
    // relit l'etat pose et renvoie le meme purgeAfter.
    const [claimed] = await tx
      .update(users)
      .set({ deletedAt, updatedAt: deletedAt })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .returning({ id: users.id });

    if (!claimed) {
      const [existing] = await tx
        .select({ deletedAt: users.deletedAt })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!existing?.deletedAt) throw new Error(`User ${userId} introuvable`);
      return { deletedAt: existing.deletedAt, purgeAfter: purgeAfterOf(existing.deletedAt) };
    }

    await tx
      .update(sessions)
      .set({ revokedAt: deletedAt })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
    const purgeAfter = purgeAfterOf(deletedAt);
    await tx.insert(gdprRequests).values({
      userId,
      type: "erasure",
      status: "pending",
      notes: `Suppression self-service, purge prevue apres ${purgeAfter.toISOString()}`,
    });
    return { deletedAt, purgeAfter };
  });
}

// Compte soft-deleted dont la grace court encore, par email. Sert au login
// pour proposer la restauration (jamais expose sans mot de passe valide).
export async function findPendingDeletionByEmail(email: string) {
  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash, deletedAt: users.deletedAt })
    .from(users)
    .where(and(eq(users.email, email), isNotNull(users.deletedAt), gt(users.deletedAt, graceCutoff())))
    .limit(1);
  return user ?? null;
}

// Variante par id (parcours OAuth : on connait deja le user).
export async function findPendingDeletionById(userId: string) {
  const [user] = await db
    .select({ id: users.id, deletedAt: users.deletedAt })
    .from(users)
    .where(and(eq(users.id, userId), isNotNull(users.deletedAt), gt(users.deletedAt, graceCutoff())))
    .limit(1);
  return user ?? null;
}

// Annule le soft delete pendant la grace. "gone" couvre les trois cas fermes :
// compte actif (deja restaure), grace expiree, compte purge (introuvable).
export async function restoreAccount(userId: string): Promise<"restored" | "gone"> {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(users)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(and(eq(users.id, userId), isNotNull(users.deletedAt), gt(users.deletedAt, graceCutoff())))
      .returning({ id: users.id });
    if (!updated) return "gone";

    const open = await tx
      .select({ id: gdprRequests.id })
      .from(gdprRequests)
      .where(
        and(
          eq(gdprRequests.userId, userId),
          eq(gdprRequests.type, "erasure"),
          inArray(gdprRequests.status, ["pending", "processing"]),
        ),
      );
    if (open.length) {
      await tx
        .update(gdprRequests)
        .set({
          status: "rejected",
          notes: "Restaure par l'utilisateur pendant la grace",
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(inArray(gdprRequests.id, open.map((r) => r.id)));
    }
    return "restored";
  });
}

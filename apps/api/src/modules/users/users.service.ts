import { db, users } from "@nextquest/db";
import { and, eq, isNull } from "drizzle-orm";
import { toUserDTO, type UserDTO } from "./users.dto.js";
import type { UpdateProfileInput } from "./users.schemas.js";

// Recupere un user actif (non soft-deleted) sous forme de DTO public.
// Retourne null si introuvable ou soft-deleted -- charge a l'appelant
// de mapper sur 404.
export async function getUserById(userId: string): Promise<UserDTO | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  return user ? toUserDTO(user) : null;
}

// Update partiel du profil. Seuls les champs presents dans l'input sont mis
// a jour. updated_at est touche automatiquement.
// Throw si user introuvable ou soft-deleted (UPDATE ... WHERE n'affecte 0 ligne).
export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<UserDTO> {
  const [updated] = await db
    .update(users)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .returning();

  if (!updated) {
    throw new Error(`User ${userId} introuvable ou soft-deleted`);
  }

  return toUserDTO(updated);
}

// Marque le tour d'onboarding comme termine. Idempotent : un appel sur un
// user deja a true ne leve pas d'erreur.
export async function completeOnboarding(
  userId: string,
): Promise<{ onboardingCompleted: true }> {
  const [updated] = await db
    .update(users)
    .set({
      onboardingCompleted: true,
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .returning({ id: users.id });

  if (!updated) {
    throw new Error(`User ${userId} introuvable ou soft-deleted`);
  }

  return { onboardingCompleted: true };
}

import type { users } from "@nextquest/db";
import type { InferSelectModel } from "drizzle-orm";

// Type complet d'une row users (incluant les champs sensibles : passwordHash, etc.)
type UserRow = InferSelectModel<typeof users>;

// DTO public renvoye au client. Tout ce qui n'est pas la est volontairement exclu
// (passwordHash, failedLoginAttempts, lockedUntil, deletedAt, role, emailVerifiedAt).
export type UserDTO = {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  locale: string;
  visibility: "private" | "friends_only" | "public";
  emailVerified: boolean;
  onboardingCompleted: boolean;
  createdAt: string; // ISO 8601
};

// Mappe une row Drizzle vers le DTO public.
// Source unique de verite pour ce que le client recoit -- evite les fuites de
// champs sensibles si on ajoute un champ a la table users.
export function toUserDTO(user: UserRow): UserDTO {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    locale: user.locale,
    visibility: user.visibility,
    emailVerified: user.emailVerified,
    onboardingCompleted: user.onboardingCompleted,
    createdAt: user.createdAt.toISOString(),
  };
}

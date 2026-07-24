import type { users } from "@nextquest/db";
import type { InferSelectModel } from "drizzle-orm";
import { z } from "zod";

import { FAVORITE_PLATFORMS, socialLinksSchema } from "./users.schemas.js";

// Type complet d'une row users (incluant les champs sensibles : passwordHash, etc.)
type UserRow = InferSelectModel<typeof users>;

// Schema du profil public renvoye au client. SOURCE UNIQUE DE VERITE : le type
// UserDTO en est infere (z.infer) et il documente + serialise les reponses
// OpenAPI. Tout champ absent est volontairement exclu (passwordHash,
// failedLoginAttempts, lockedUntil, deletedAt, role, emailVerifiedAt) pour ne
// jamais laisser fuiter de donnee sensible, y compris si on ajoute un champ a
// la table users.
export const userDTOSchema = z
  .object({
    id: z.uuid().describe("Identifiant unique de l'utilisateur"),
    email: z.email().describe("Adresse email"),
    username: z.string().describe("Nom d'utilisateur unique"),
    displayName: z.string().nullable().describe("Nom d'affichage public"),
    avatarUrl: z.string().nullable().describe("URL de l'avatar"),
    bio: z.string().nullable().describe("Biographie"),
    country: z
      .string()
      .nullable()
      .describe("Code pays ISO 3166-1 alpha-2"),
    birthdate: z.string().nullable().describe("Date de naissance (YYYY-MM-DD)"),
    favoritePlatform: z
      .enum(FAVORITE_PLATFORMS)
      .nullable()
      .describe("Plateforme mise en avant sur le profil"),
    socialLinks: socialLinksSchema
      .nullable()
      .describe("Liens sociaux whitelists"),
    locale: z.string().describe("Langue preferee (ex: fr, en)"),
    visibility: z
      .enum(["private", "friends_only", "public"])
      .describe("Visibilite du profil"),
    emailVerified: z.boolean().describe("Adresse email verifiee"),
    onboardingCompleted: z.boolean().describe("Tour d'onboarding termine"),
    createdAt: z.string().describe("Date de creation du compte (ISO 8601)"),
  })
  .describe("Profil public d'un utilisateur");

export type UserDTO = z.infer<typeof userDTOSchema>;

// Mappe une row Drizzle vers le DTO public.
export function toUserDTO(user: UserRow): UserDTO {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    country: user.country,
    birthdate: user.birthdate,
    // varchar en BDD mais toujours ecrit via Zod : le cast est sur.
    favoritePlatform: (user.favoritePlatform ?? null) as UserDTO["favoritePlatform"],
    socialLinks: user.socialLinks,
    locale: user.locale,
    visibility: user.visibility,
    emailVerified: user.emailVerified,
    onboardingCompleted: user.onboardingCompleted,
    createdAt: user.createdAt.toISOString(),
  };
}

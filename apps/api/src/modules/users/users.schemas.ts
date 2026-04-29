import { z } from "zod";

// Update partiel : tous les champs optionnels, mais au moins un requis.
// Aligne sur les contraintes de la colonne BDD users (length, enum).
export const updateProfileSchema = z
  .object({
    displayName: z.string().min(1).max(50).optional(),
    avatarUrl: z.string().url().max(2048).optional(),
    bio: z.string().max(500).optional(), // chaine vide autorisee pour reset
    locale: z.enum(["fr", "en"]).optional(),
    visibility: z.enum(["private", "friends_only", "public"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Au moins un champ requis pour la mise a jour",
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

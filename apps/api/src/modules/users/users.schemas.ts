import { z } from "zod";

// Plateformes affichables en badge sur le profil. La colonne BDD est un
// varchar(20) : la source de verite du domaine est cette liste.
export const FAVORITE_PLATFORMS = [
  "pc",
  "playstation",
  "xbox",
  "nintendo",
  "mobile",
] as const;

// Liens sociaux : whitelist stricte, https uniquement. .strict() rejette
// toute cle hors liste (pas de jsonb fourre-tout en base).
const httpsUrl = z.url({ protocol: /^https$/ }).max(255);
export const socialLinksSchema = z
  .object({
    twitch: httpsUrl.optional(),
    youtube: httpsUrl.optional(),
    discord: httpsUrl.optional(),
    twitter: httpsUrl.optional(),
    instagram: httpsUrl.optional(),
  })
  .strict();

// YYYY-MM-DD strict, borne a une plage plausible. La comparaison lexicale
// equivaut a la comparaison chronologique sur ce format.
const birthdateSchema = z.iso
  .date()
  .refine(
    (d) => d >= "1900-01-01" && d <= new Date().toISOString().slice(0, 10),
    { message: "Date de naissance hors plage valide" },
  );

// Update partiel : tous les champs optionnels, mais au moins un requis.
// Les champs du profil etendu acceptent null pour l'effacement explicite.
export const updateProfileSchema = z
  .object({
    displayName: z.string().min(1).max(50).optional(),
    avatarUrl: z.string().url().max(2048).optional(),
    bio: z.string().max(500).optional(), // chaine vide autorisee pour reset
    locale: z.enum(["fr", "en"]).optional(),
    visibility: z.enum(["private", "friends_only", "public"]).optional(),
    country: z
      .string()
      .regex(/^[A-Z]{2}$/, "Code pays ISO 3166-1 alpha-2 attendu")
      .nullable()
      .optional(),
    birthdate: birthdateSchema.nullable().optional(),
    favoritePlatform: z.enum(FAVORITE_PLATFORMS).nullable().optional(),
    socialLinks: socialLinksSchema.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Au moins un champ requis pour la mise a jour",
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// Reponse de fin d'onboarding (documentation + serialisation OpenAPI).
export const onboardingResultSchema = z
  .object({
    onboardingCompleted: z
      .boolean()
      .describe("Toujours true apres l'appel (idempotent)"),
  })
  .describe("Etat de l'onboarding");

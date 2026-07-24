// Validation Zod des inputs auth -- premiere ligne de defense avant toute logique metier
import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30),
  password: z.string().min(8).max(128),
  displayName: z.string().max(50).optional(),
  locale: z.enum(["fr", "en"]).default("fr"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Le refreshToken est optionnel dans le body car il peut venir du cookie httpOnly
export const refreshSchema = z.object({
  refreshToken: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// ── Schemas de reponse (documentation + serialisation OpenAPI) ──────────────

// User "leger" renvoye par register / login / refresh : sous-ensemble du profil
// + role (lu cote client pour l'affichage). Le profil public complet est servi
// par GET /auth/me et GET /users/me (userDTOSchema).
export const authUserSchema = z
  .object({
    id: z.uuid().describe("Identifiant de l'utilisateur"),
    email: z.email().describe("Adresse email"),
    username: z.string().describe("Nom d'utilisateur"),
    displayName: z.string().nullable().describe("Nom d'affichage"),
    locale: z.string().describe("Langue preferee (ex: fr, en)"),
    role: z.enum(["user", "admin"]).describe("Role applicatif"),
  })
  .describe("Utilisateur (forme retournee a l'authentification)");

// Reponse d'une authentification reussie : profil leger + tokens.
export const authTokensSchema = z
  .object({
    user: authUserSchema,
    accessToken: z.string().describe("Access token JWT, valide 15 minutes"),
    refreshToken: z
      .string()
      .describe(
        "Refresh token valide 30 jours (aussi pose dans un cookie HttpOnly)",
      ),
  })
  .describe("Session authentifiee : profil et tokens");

// Suppression de compte : mot de passe requis pour les comptes locaux
// (verifie dans le handler, pas ici : les comptes OAuth n'en ont pas).
export const deleteAccountSchema = z
  .object({ password: z.string().min(1).optional() })
  .nullish();

export const deletionResultSchema = z
  .object({
    deletedAt: z.string().describe("Date du soft delete (ISO 8601)"),
    purgeAfter: z.string().describe("Date de purge definitive (ISO 8601) — restauration possible avant"),
  })
  .describe("Compte place en grace de suppression");

// Purpose distinctif du token de restauration, pour eviter qu'un access token
// classique (ou tout autre JWT de l'app) ne soit accepte sur POST /auth/restore.
export const RESTORE_TOKEN_PURPOSE = "account-restore";

// Login sur un compte en grace de suppression + mot de passe correct : on le
// signale et on fournit un token court dedie a la restauration.
export const pendingDeletionSchema = z
  .object({
    error: z.literal("accountPendingDeletion"),
    deletedAt: z.string().describe("Date du soft delete (ISO 8601)"),
    purgeAfter: z.string().describe("Fin de la grace (ISO 8601)"),
    restoreToken: z.string().describe("JWT 15 min a presenter sur POST /auth/restore"),
  })
  .describe("Compte en attente de suppression : restauration possible");

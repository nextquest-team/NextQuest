import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  date,
  jsonb,
  unique,
  index,
} from "drizzle-orm/pg-core";
import {
  userRoleEnum,
  visibilityEnum,
  verificationTokenTypeEnum,
} from "./enums.js";
import { services } from "./services.js";

// Liens sociaux du profil : whitelist de plateformes, URLs https validees
// par Zod cote API avant toute ecriture. Jamais de cle arbitraire en base.
export type SocialLinks = Partial<
  Record<"twitch" | "youtube" | "discord" | "twitter" | "instagram", string>
>;

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 30 }).notNull().unique(),
  passwordHash: text("password_hash"),
  displayName: varchar("display_name", { length: 50 }),
  avatarUrl: varchar("avatar_url", { length: 2048 }),
  bio: varchar("bio", { length: 500 }),
  // --- Profil etendu (tous nullables : rien n'est requis a l'inscription) ---
  // Code pays ISO 3166-1 alpha-2 (ex: FR, BE). Valide par Zod cote API.
  country: varchar("country", { length: 2 }),
  // YYYY-MM-DD en mode string : pas de fuseau a gerer, le DTO renvoie tel quel.
  birthdate: date("birthdate", { mode: "string" }),
  // Plateforme mise en avant sur le profil. Enum applicative (Zod), varchar en
  // BDD pour eviter une migration de type pg si la liste evolue.
  favoritePlatform: varchar("favorite_platform", { length: 20 }),
  socialLinks: jsonb("social_links").$type<SocialLinks>(),
  locale: varchar("locale", { length: 5 }).notNull().default("fr"),
  visibility: visibilityEnum("visibility").notNull().default("public"),
  role: userRoleEnum("role").notNull().default("user"),
  emailVerified: boolean("email_verified").notNull().default(false),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  // Flag pilote par le tour guide front. Mis a true via POST /api/users/me/onboarding/complete.
  // Le back ne connait pas les etapes UX du tour, juste cet etat binaire.
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  // Brute-force protection : on verrouille le compte apres N echecs
  failedLoginAttempts: integer("failed_login_attempts")
    .notNull()
    .default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  // Soft delete pour RGPD : on anonymise mais on garde la trace pour l'integrite referentielle
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

// auth_providers = methodes de connexion (Google, Discord...) pour s'authentifier sur NextQuest
// A ne pas confondre avec connected_services qui servent a importer les jeux
export const authProviders = pgTable(
  "auth_providers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 50 }).notNull(),
    providerId: varchar("provider_id", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    avatarUrl: varchar("avatar_url", { length: 2048 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Un compte externe ne peut etre lie qu'a un seul user NextQuest
    unique().on(t.provider, t.providerId),
    // Un user ne peut pas lier deux comptes du meme provider
    unique().on(t.userId, t.provider),
  ],
);

// Sessions avec rotation de refresh tokens (famille + generation)
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    refreshTokenHash: varchar("refresh_token_hash", { length: 128 })
      .notNull()
      .unique(),
    // family_id + generation = detection de vol de token (si un ancien token est reutilise,
    // on revoque toute la famille car c'est signe de compromission)
    familyId: uuid("family_id").notNull(),
    generation: integer("generation").notNull().default(1),
    deviceName: varchar("device_name", { length: 100 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_sessions_user_id").on(t.userId),
    index("idx_sessions_family_id").on(t.familyId),
  ],
);

// Tokens a usage unique : verification email + reset mot de passe
export const verificationTokens = pgTable(
  "verification_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: verificationTokenTypeEnum("type").notNull(),
    // On stocke le hash, jamais le token en clair (meme principe que les mots de passe)
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    // Limite le nombre de tentatives pour eviter le bruteforce sur les tokens courts
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique().on(t.tokenHash),
    index("idx_verification_tokens_user_type").on(t.userId, t.type),
  ],
);

// connected_services = liens vers Steam, PSN, Xbox... pour IMPORTER les jeux
// Rien a voir avec auth_providers qui gerent l'authentification
export const connectedServices = pgTable(
  "connected_services",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    externalUserId: varchar("external_user_id", { length: 255 }).notNull(),
    externalUsername: varchar("external_username", { length: 255 }),
    // Tokens chiffres en BDD (AES-256) -- le versionning permet la rotation de cles
    accessTokenEncrypted: text("access_token_encrypted"),
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    encryptionKeyVersion: integer("encryption_key_version")
      .notNull()
      .default(1),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (t) => [unique().on(t.userId, t.serviceId)],
);

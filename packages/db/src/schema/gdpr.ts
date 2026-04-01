import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import {
  consentTypeEnum,
  gdprRequestTypeEnum,
  gdprRequestStatusEnum,
} from "./enums.js";
import { users } from "./users.js";

// Conformite RGPD : on trace chaque consentement avec version, date et IP
// Obligatoire pour prouver le consentement en cas de controle CNIL
export const userConsents = pgTable(
  "user_consents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    consentType: consentTypeEnum("consent_type").notNull(),
    version: varchar("version", { length: 20 }).notNull(),
    granted: boolean("granted").notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    grantedAt: timestamp("granted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_user_consents_user_id_consent_type").on(
      t.userId,
      t.consentType,
    ),
  ],
);

// Demandes RGPD des utilisateurs (droit d'acces, de suppression, de portabilite...)
// Delai legal : 30 jours pour traiter une demande
export const gdprRequests = pgTable("gdpr_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  type: gdprRequestTypeEnum("type").notNull(),
  status: gdprRequestStatusEnum("status").notNull().default("pending"),
  notes: text("notes"),
  processedBy: uuid("processed_by").references(() => users.id, {
    onDelete: "set null",
  }),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

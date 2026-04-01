import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

// Logs d'audit securite (OWASP A09 - Security Logging and Monitoring)
// Trace les actions sensibles : login, changement mdp, suppression compte, acces admin...
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // SET NULL : on garde le log meme si le user est supprime (obligation legale)
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 50 }).notNull(),
    targetType: varchar("target_type", { length: 50 }),
    targetId: uuid("target_id"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_audit_logs_user_id").on(t.userId),
    index("idx_audit_logs_action").on(t.action),
    index("idx_audit_logs_created_at").on(t.createdAt),
  ],
);

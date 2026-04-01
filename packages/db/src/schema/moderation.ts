import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { reportStatusEnum } from "./enums.js";
import { users } from "./users.js";

// Signalements utilisateurs -- FK polymorphique : target_type + target_id
// pointent vers n'importe quelle entite (message, profil, review...)
// sans FK en dur car ca changerait a chaque nouveau type signalable
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reporterId: uuid("reporter_id").references(() => users.id, {
      onDelete: "set null",
    }),
    targetType: varchar("target_type", { length: 50 }).notNull(),
    targetId: uuid("target_id").notNull(),
    reason: varchar("reason", { length: 255 }).notNull(),
    description: text("description"),
    status: reportStatusEnum("status").notNull().default("pending"),
    moderatedBy: uuid("moderated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_reports_status_created_at").on(t.status, t.createdAt),
  ],
);

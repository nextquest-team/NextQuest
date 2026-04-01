import {
  pgTable,
  uuid,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { activityTypeEnum, visibilityEnum } from "./enums.js";
import { users } from "./users.js";

// Fil d'activite : chaque action notable genere une entree pour le feed social
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: activityTypeEnum("type").notNull(),
    data: jsonb("data"),
    visibility: visibilityEnum("visibility").notNull().default("friends_only"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("idx_activities_user_id_created_at").on(t.userId, t.createdAt)],
);

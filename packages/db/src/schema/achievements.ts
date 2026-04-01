import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  numeric,
  unique,
  primaryKey,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { userGames } from "./collection.js";

// Succes/trophees importes depuis Steam, PSN, Xbox... lies a un jeu dans la collection
export const externalAchievements = pgTable(
  "external_achievements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userGameId: uuid("user_game_id")
      .notNull()
      .references(() => userGames.id, { onDelete: "cascade" }),
    externalId: varchar("external_id", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    iconUrl: varchar("icon_url", { length: 2048 }),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }),
    rarity: numeric("rarity", { precision: 5, scale: 2 }),
  },
  (t) => [unique().on(t.userGameId, t.externalId)],
);

// Badges internes NextQuest (gamification) -- rien a voir avec les succes externes
// unlockCondition en JSONB pour definir des regles flexibles sans modifier le schema
export const badges = pgTable("badges", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  iconUrl: varchar("icon_url", { length: 2048 }),
  unlockCondition: jsonb("unlock_condition").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const userBadges = pgTable(
  "user_badges",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    badgeId: uuid("badge_id")
      .notNull()
      .references(() => badges.id, { onDelete: "cascade" }),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.badgeId] })],
);

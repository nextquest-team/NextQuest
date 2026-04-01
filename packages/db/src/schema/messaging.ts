import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { conversationTypeEnum, conversationRoleEnum } from "./enums.js";
import { users } from "./users.js";

export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: conversationTypeEnum("type").notNull().default("direct"),
  name: varchar("name", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const conversationMembers = pgTable(
  "conversation_members",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: conversationRoleEnum("role").notNull().default("member"),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    isMuted: boolean("is_muted").notNull().default(false),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.userId] })],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    // SET NULL si le user est supprime : on garde le message mais on anonymise l'auteur (RGPD)
    senderId: uuid("sender_id").references(() => users.id, {
      onDelete: "set null",
    }),
    content: text("content").notNull(),
    // Soft delete : le message disparait de l'UI mais reste en BDD pour la moderation
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_messages_conversation_id_created_at").on(
      t.conversationId,
      t.createdAt,
    ),
  ],
);

import {
  pgTable,
  uuid,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { friendshipStatusEnum } from "./enums.js";
import { users } from "./users.js";

// Relation unidirectionnelle : user_id envoie la demande, friend_id la recoit
// Le blocage se fait via status='blocked' -- un user bloque ne peut plus envoyer de demande
// ni de message (regle anti-harcelement verifiee cote service)
export const friendships = pgTable(
  "friendships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    friendId: uuid("friend_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: friendshipStatusEnum("status").notNull().default("pending"),
    blockedAt: timestamp("blocked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (t) => [
    // Empeche les demandes en doublon, mais attention : (A,B) et (B,A) sont differents
    unique().on(t.userId, t.friendId),
    index("idx_friendships_friend_id_status").on(t.friendId, t.status),
  ],
);

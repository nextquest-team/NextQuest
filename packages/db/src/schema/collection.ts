import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  date,
  index,
  unique,
  primaryKey,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { games } from "./games.js";
import { platforms, services, tags } from "./services.js";
import { gameStatusEnum } from "./enums.js";

export const userGames = pgTable(
  "user_games",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id").references(() => services.id, {
      onDelete: "set null",
    }),
    platformId: uuid("platform_id").references(() => platforms.id, {
      onDelete: "restrict",
    }),
    status: gameStatusEnum("status").notNull().default("backlog"),
    rating: integer("rating"),
    review: text("review"),
    playtimeMinutes: integer("playtime_minutes"),
    isHidden: boolean("is_hidden").notNull().default(false),
    startedAt: date("started_at"),
    completedAt: date("completed_at"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (t) => [
    // Un user peut avoir le meme jeu sur plusieurs plateformes (ex: Zelda Switch + PC)
    // mais pas deux fois sur la meme. platformId nullable = jeu sans plateforme specifique
    // Note : PostgreSQL traite les NULL comme distincts dans les contraintes UNIQUE,
    // donc (user, game, NULL) peut exister plusieurs fois -- a gerer cote appli
    unique("user_games_user_id_game_id_platform_id_unique").on(
      t.userId,
      t.gameId,
      t.platformId,
    ),
    index("user_games_user_id_status_idx").on(t.userId, t.status),
  ],
);

// Tags perso que l'user peut ajouter a ses jeux (ex: "a faire en coop", "platine facile")
export const userGameTags = pgTable(
  "user_game_tags",
  {
    userGameId: uuid("user_game_id")
      .notNull()
      .references(() => userGames.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userGameId, t.tagId] })],
);

// Historique des changements de statut pour alimenter le fil d'activite et les stats
export const userGameStatusHistory = pgTable(
  "user_game_status_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userGameId: uuid("user_game_id")
      .notNull()
      .references(() => userGames.id, { onDelete: "cascade" }),
    oldStatus: gameStatusEnum("old_status"),
    newStatus: gameStatusEnum("new_status").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("user_game_status_history_user_game_id_changed_at_idx").on(
      t.userGameId,
      t.changedAt,
    ),
  ],
);

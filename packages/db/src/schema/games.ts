import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  real,
  boolean,
  timestamp,
  date,
  index,
  unique,
  primaryKey,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { platforms } from "./services.js";
import { genres, tags } from "./services.js";
import {
  releaseStatusEnum,
  visibilityEnum,
  gameUpdateSourceEnum,
  releaseDatePrecisionEnum,
} from "./enums.js";

export const games = pgTable(
  "games",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    igdbId: integer("igdb_id"),
    rawgId: integer("rawg_id"),
    // Identifiant Steam (appid). Sert a dedupliquer les imports et a raccorder
    // le jeu a IGDB plus tard via external_games. Unique : un appid = un jeu.
    steamAppid: integer("steam_appid"),
    title: varchar("title", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    description: text("description"),
    coverUrl: varchar("cover_url", { length: 2048 }),
    backgroundUrl: varchar("background_url", { length: 2048 }),
    releaseDate: date("release_date"),
    releaseStatus: releaseStatusEnum("release_status")
      .notNull()
      .default("released"),
    // Null = jamais calcule (lignes anterieures a la feature, jeux custom).
    releaseDatePrecision: releaseDatePrecisionEnum("release_date_precision"),
    developer: varchar("developer", { length: 255 }),
    publisher: varchar("publisher", { length: 255 }),
    avgPlaytime: integer("avg_playtime"),
    // Note joueurs IGDB (0-100, decimale) et nombre de votes. Signal qualite
    // exploite par la reco (#58) avec un seuil de votes minimum.
    igdbRating: real("igdb_rating"),
    igdbRatingCount: integer("igdb_rating_count"),
    // Signal d'anticipation IGDB (nb de gens qui suivent/attendent le jeu).
    // Sert de signal qualite pour les jeux pas encore sortis (reco bucket "upcoming"),
    // ou la note joueurs n'existe pas encore.
    igdbHypes: integer("igdb_hypes"),
    // Type IGDB du jeu (0=main, 1=dlc, 2=expansion, 3=bundle, 4=standalone_expansion,
    // 13=pack). Sert a filtrer les DLC/editions des recommandations.
    gameType: integer("game_type"),
    // igdb_id du jeu de base quand ce jeu est une edition/version (ex: "Game GOTY").
    // Permet de rattacher une edition a son jeu principal pour la reco.
    versionParentIgdbId: integer("version_parent_igdb_id"),
    // Les jeux custom sont ceux ajoutes manuellement par un user (pas dans IGDB/RAWG)
    isCustom: boolean("is_custom").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    // Un jeu custom est prive par defaut, visible uniquement par son createur
    visibility: visibilityEnum("visibility").notNull().default("private"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (t) => [
    index("games_igdb_id_idx").on(t.igdbId),
    index("games_rawg_id_idx").on(t.rawgId),
    unique("games_slug_unique").on(t.slug),
    unique("games_steam_appid_unique").on(t.steamAppid),
  ],
);

export const gamePlatforms = pgTable(
  "game_platforms",
  {
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    platformId: uuid("platform_id")
      .notNull()
      .references(() => platforms.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.platformId] })],
);

export const gameGenres = pgTable(
  "game_genres",
  {
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    genreId: uuid("genre_id")
      .notNull()
      .references(() => genres.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.genreId] })],
);

export const gameTags = pgTable(
  "game_tags",
  {
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.tagId] })],
);

// Suivi des changements detectes par les syncs IGDB/RAWG (nouvelle date de sortie, etc.)
// Sert a notifier les users qui ont ce jeu dans leur collection
export const gameUpdates = pgTable(
  "game_updates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    fieldChanged: varchar("field_changed", { length: 100 }).notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    source: gameUpdateSourceEnum("source").notNull(),
    detectedAt: timestamp("detected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Le worker de notifications marque processed=true apres avoir alerte les users concernes
    processed: boolean("processed").notNull().default(false),
  },
  (t) => [
    index("game_updates_game_id_detected_at_idx").on(t.gameId, t.detectedAt),
    index("game_updates_processed_detected_at_idx").on(
      t.processed,
      t.detectedAt,
    ),
  ],
);

// Jeux similaires suggeres par IGDB. On stocke l'id IGDB brut (et non une FK vers
// games.id) car la plupart des jeux similaires ne sont pas encore dans notre
// catalogue : on n'a que les bibliotheques des users. La reco (#58) resout et
// hydrate ces candidats au moment voulu.
export const gameSimilar = pgTable(
  "game_similar",
  {
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    similarIgdbId: integer("similar_igdb_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.gameId, t.similarIgdbId] }),
    index("game_similar_similar_igdb_id_idx").on(t.similarIgdbId),
  ],
);

// Suivi de sortie ("etoile" timeline) : quels users guettent quels jeux.
// Le jeu est hydrate dans games au moment du follow (hydrateGamesByIgdbIds),
// donc game_id est toujours resoluble. CASCADE des deux cotes : supprimer un
// user purge ses suivis (RGPD), supprimer un jeu purge les suivis orphelins.
export const userFollowedGames = pgTable(
  "user_followed_games",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.gameId] }),
    // "Quels users suivent ce jeu" : requete des futures alertes de sortie.
    index("user_followed_games_game_id_idx").on(t.gameId),
  ],
);

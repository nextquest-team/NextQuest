import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";

// Plateforme = le hardware (PS5, Switch, PC...) -- c'est ou on joue
export const platforms = pgTable("platforms", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  iconUrl: varchar("icon_url", { length: 2048 }),
  // Id de la plateforme cote IGDB (endpoint /platforms). Permet de mapper les
  // plateformes renvoyees par une recherche IGDB vers nos enregistrements locaux
  // (ex: proposer a l'ajout uniquement les plateformes sur lesquelles le jeu existe).
  // Null pour les plateformes sans equivalent IGDB (ex: Steam Deck).
  igdbId: integer("igdb_id").unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Service = le store/launcher (Steam, PSN, Epic...) -- c'est d'ou on importe la bibliotheque
export const services = pgTable("services", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  apiAvailable: boolean("api_available").notNull().default(true),
  iconUrl: varchar("icon_url", { length: 2048 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Un service peut couvrir plusieurs plateformes (ex: Steam = PC + Steam Deck)
export const servicePlatforms = pgTable(
  "service_platforms",
  {
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    platformId: uuid("platform_id")
      .notNull()
      .references(() => platforms.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.serviceId, t.platformId] })],
);

export const genres = pgTable("genres", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  igdbId: integer("igdb_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    category: varchar("category", { length: 50 }),
    // Renseigne pour les tags issus d'IGDB (themes au MVP). Permet de dedupliquer
    // par (category, igdb_id) plutot que par slug : evite une collision de slug si
    // on importe plus tard les keywords IGDB (cf. #72).
    igdbId: integer("igdb_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("tags_category_igdb_id_unique").on(t.category, t.igdbId)],
);

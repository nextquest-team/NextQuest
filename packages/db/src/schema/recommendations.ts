import {
  pgTable,
  uuid,
  timestamp,
  jsonb,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { recommendationFeedbackEnum, recommendationBucketEnum } from "./enums.js";
import { users } from "./users.js";
import { games } from "./games.js";

export const recommendations = pgTable(
  "recommendations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    // reason en JSONB : explique pourquoi le jeu est recommande (genres similaires, amis, etc.)
    reason: jsonb("reason"),
    // Score entre 0 et 1 (ex: 0.875) -- plus c'est haut, plus le match est bon
    score: numeric("score", { precision: 4, scale: 3 }),
    // Le feedback utilisateur sert a affiner les futures recommandations
    feedback: recommendationFeedbackEnum("feedback"),
    // Categorie de reco : pilote la strategie de candidats et le signal qualite.
    bucket: recommendationBucketEnum("bucket").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    feedbackAt: timestamp("feedback_at", { withTimezone: true }),
    // "Passe pour l'instant" via le bouton refresh : fait tourner les recos sans
    // decision definitive. Distinct de feedback (qui exclut le jeu et alimente le
    // profil de gout). NULL = jamais passe. La liste trie skipped_at ASC NULLS FIRST
    // pour que les jeux passes reviennent en dernier, apres le tour du pool.
    skippedAt: timestamp("skipped_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_recommendations_user_id_created_at").on(t.userId, t.createdAt),
    index("idx_recommendations_user_id_bucket").on(t.userId, t.bucket),
  ],
);

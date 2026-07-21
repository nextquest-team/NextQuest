DROP TABLE "user_game_exclusions" CASCADE;--> statement-breakpoint
ALTER TABLE "user_games" ADD COLUMN "excluded_at" timestamp with time zone;
CREATE TYPE "public"."release_date_precision_enum" AS ENUM('day', 'month', 'quarter', 'year', 'tbd');--> statement-breakpoint
CREATE TABLE "user_followed_games" (
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_followed_games_user_id_game_id_pk" PRIMARY KEY("user_id","game_id")
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "release_date_precision" "release_date_precision_enum";--> statement-breakpoint
ALTER TABLE "user_followed_games" ADD CONSTRAINT "user_followed_games_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_followed_games" ADD CONSTRAINT "user_followed_games_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_followed_games_game_id_idx" ON "user_followed_games" USING btree ("game_id");
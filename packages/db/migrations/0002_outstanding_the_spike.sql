ALTER TABLE "games" ADD COLUMN "steam_appid" integer;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_steam_appid_unique" UNIQUE("steam_appid");
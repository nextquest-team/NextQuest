ALTER TABLE "platforms" ADD COLUMN "igdb_id" integer;--> statement-breakpoint
ALTER TABLE "platforms" ADD CONSTRAINT "platforms_igdb_id_unique" UNIQUE("igdb_id");
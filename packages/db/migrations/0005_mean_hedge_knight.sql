CREATE TYPE "public"."recommendation_bucket_enum" AS ENUM('library_unplayed', 'discovery', 'upcoming');--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "igdb_hypes" integer;--> statement-breakpoint
ALTER TABLE "recommendations" ADD COLUMN "bucket" "recommendation_bucket_enum" NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_recommendations_user_id_bucket" ON "recommendations" USING btree ("user_id","bucket");
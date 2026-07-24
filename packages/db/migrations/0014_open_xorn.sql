ALTER TABLE "users" ADD COLUMN "country" varchar(2);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "birthdate" date;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "favorite_platform" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "social_links" jsonb;
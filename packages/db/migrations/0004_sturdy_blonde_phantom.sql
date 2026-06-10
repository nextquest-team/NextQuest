CREATE TABLE "game_similar" (
	"game_id" uuid NOT NULL,
	"similar_igdb_id" integer NOT NULL,
	CONSTRAINT "game_similar_game_id_similar_igdb_id_pk" PRIMARY KEY("game_id","similar_igdb_id")
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "igdb_rating" real;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "igdb_rating_count" integer;--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "igdb_id" integer;--> statement-breakpoint
ALTER TABLE "game_similar" ADD CONSTRAINT "game_similar_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_similar_similar_igdb_id_idx" ON "game_similar" USING btree ("similar_igdb_id");--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_category_igdb_id_unique" UNIQUE("category","igdb_id");
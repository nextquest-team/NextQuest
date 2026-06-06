-- Donnees de reference : service Steam + plateforme PC + lien service_platforms.
-- Necessaires a l'import de bibliotheque (user_games.service_id / platform_id).
-- Versionnees ici (et pas dans le seed) pour etre presentes partout, CI comprise.
-- Idempotent via ON CONFLICT sur les codes uniques.

INSERT INTO "services" ("name", "code", "api_available")
VALUES ('Steam', 'steam', true)
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "platforms" ("name", "code")
VALUES ('PC', 'pc')
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "service_platforms" ("service_id", "platform_id")
SELECT s."id", p."id"
FROM "services" s, "platforms" p
WHERE s."code" = 'steam' AND p."code" = 'pc'
ON CONFLICT ("service_id", "platform_id") DO NOTHING;

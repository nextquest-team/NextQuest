-- Donnee de reference : mapping plateformes locales -> IGDB (endpoint /platforms).
-- Jusqu'ici ce mapping ne vivait que dans packages/db/src/seed.ts (script execute a la
-- main en dev). Sur toute base fraiche (CI, nextquest_test, prod future) ou seed.ts
-- n'est jamais lance, platforms.igdb_id reste NULL et la resolution IGDB -> plateformes
-- locales (bloc game_platforms d'upsertEnrichedGame, igdb.discovery.service) ne matche
-- jamais aucune plateforme. Cette migration garantit la donnee par la BDD elle-meme,
-- pas seulement par un outil de dev.
-- Idempotente et convergente : upsert par "code" (ON CONFLICT), precede d'une purge
-- defensive de tout igdb_id deja porte par une AUTRE ligne, pour ne jamais violer la
-- contrainte unique sur "igdb_id" (en pratique nos bases ont soit igdb_id NULL, soit
-- deja la bonne valeur, mais la migration reste sure dans tous les cas).

-- Etape 1 : libere les igdb_id cibles s'ils sont portes par une ligne qui ne devrait
-- pas les avoir (protege l'upsert ci-dessous contre la contrainte unique).
UPDATE "platforms" p
SET "igdb_id" = NULL
FROM (VALUES
  ('pc', 6),
  ('ps5', 167),
  ('ps4', 48),
  ('xbox_series', 169),
  ('xbox_one', 49),
  ('switch', 130),
  ('switch2', 508)
) AS ref(code, igdb_id)
WHERE p."igdb_id" = ref.igdb_id AND p."code" != ref.code;
--> statement-breakpoint

-- Etape 2 : upsert idempotent des 8 plateformes de reference.
INSERT INTO "platforms" ("name", "code", "igdb_id")
VALUES
  ('PC', 'pc', 6),
  ('PlayStation 5', 'ps5', 167),
  ('PlayStation 4', 'ps4', 48),
  ('Xbox Series X|S', 'xbox_series', 169),
  ('Xbox One', 'xbox_one', 49),
  ('Nintendo Switch', 'switch', 130),
  ('Nintendo Switch 2', 'switch2', 508),
  -- Pas d'equivalent IGDB pour Steam Deck (c'est un PC sous le capot cote IGDB).
  ('Steam Deck', 'steam_deck', NULL)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "igdb_id" = EXCLUDED."igdb_id";

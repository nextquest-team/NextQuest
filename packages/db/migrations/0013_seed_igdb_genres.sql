-- Referentiel complet des genres IGDB (stable cote IGDB). Upsert par slug :
-- les lignes deja creees par l'enrichissement des bibliotheques sont conservees
-- et recuperent leur igdb_id si manquant.
INSERT INTO "genres" ("name", "slug", "igdb_id") VALUES
  ('Point-and-click', 'point-and-click', 2),
  ('Fighting', 'fighting', 4),
  ('Shooter', 'shooter', 5),
  ('Music', 'music', 7),
  ('Platform', 'platform', 8),
  ('Puzzle', 'puzzle', 9),
  ('Racing', 'racing', 10),
  ('Real Time Strategy (RTS)', 'real-time-strategy-rts', 11),
  ('Role-playing (RPG)', 'role-playing-rpg', 12),
  ('Simulator', 'simulator', 13),
  ('Sport', 'sport', 14),
  ('Strategy', 'strategy', 15),
  ('Turn-based strategy (TBS)', 'turn-based-strategy-tbs', 16),
  ('Tactical', 'tactical', 24),
  ('Hack and slash/Beat ''em up', 'hack-and-slash-beat-em-up', 25),
  ('Quiz/Trivia', 'quiz-trivia', 26),
  ('Pinball', 'pinball', 30),
  ('Adventure', 'adventure', 31),
  ('Indie', 'indie', 32),
  ('Arcade', 'arcade', 33),
  ('Visual Novel', 'visual-novel', 34),
  ('Card & Board Game', 'card-and-board-game', 35),
  ('MOBA', 'moba', 36)
ON CONFLICT ("slug") DO UPDATE SET "igdb_id" = excluded."igdb_id";

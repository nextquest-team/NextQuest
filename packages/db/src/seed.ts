import { sql } from "drizzle-orm";
import { db } from "./client.js";
import { users } from "./schema/users.js";
import { platforms } from "./schema/services.js";

async function seed() {
  console.log("Seeding database...");

  await db
    .insert(users)
    .values([
      {
        email: "jb@nextquest.dev",
        username: "jb",
        passwordHash: "$2b$10$placeholder",
        displayName: "Jean-Baptiste",
        locale: "fr",
      },
      {
        email: "lorelei@nextquest.dev",
        username: "lorelei",
        passwordHash: "$2b$10$placeholder",
        displayName: "Lorelei",
        locale: "fr",
      },
    ])
    .onConflictDoNothing();

  // Referentiel des plateformes materielles (alimente le selecteur d'ajout
  // manuel et l'import). Idempotent par code, mais onConflictDoUpdate (pas
  // DoNothing) : le seed doit pouvoir renseigner igdbId sur des lignes deja
  // presentes (mapping recherche IGDB -> plateformes locales, cf. igdb.discovery.service).
  await db
    .insert(platforms)
    .values([
      { name: "PC", code: "pc", igdbId: 6 },
      { name: "PlayStation 5", code: "ps5", igdbId: 167 },
      { name: "PlayStation 4", code: "ps4", igdbId: 48 },
      { name: "Xbox Series X|S", code: "xbox_series", igdbId: 169 },
      { name: "Xbox One", code: "xbox_one", igdbId: 49 },
      { name: "Nintendo Switch", code: "switch", igdbId: 130 },
      { name: "Nintendo Switch 2", code: "switch2", igdbId: 508 },
      // Pas d'equivalent IGDB pour Steam Deck (c'est un PC sous le capot cote IGDB).
      { name: "Steam Deck", code: "steam_deck", igdbId: null },
    ])
    .onConflictDoUpdate({
      target: platforms.code,
      set: {
        name: sql.raw(`excluded.${platforms.name.name}`),
        igdbId: sql.raw(`excluded.${platforms.igdbId.name}`),
      },
    });

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

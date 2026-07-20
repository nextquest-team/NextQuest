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
  // manuel et l'import). Idempotent : le code est unique.
  await db
    .insert(platforms)
    .values([
      { name: "PC", code: "pc" },
      { name: "PlayStation 5", code: "ps5" },
      { name: "PlayStation 4", code: "ps4" },
      { name: "Xbox Series X|S", code: "xbox_series" },
      { name: "Xbox One", code: "xbox_one" },
      { name: "Nintendo Switch", code: "switch" },
      { name: "Nintendo Switch 2", code: "switch2" },
      { name: "Steam Deck", code: "steam_deck" },
    ])
    .onConflictDoNothing();

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

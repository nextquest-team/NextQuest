import { db } from "./client.js";
import { users } from "./schema/users.js";

async function seed() {
  console.log("Seeding database...");

  await db.insert(users).values([
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
  ]);

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

// Config Drizzle Kit : genere les migrations SQL a partir des schemas TypeScript
// Le .env est a la racine du monorepo, d'ou le ../../
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: "../../.env" });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});

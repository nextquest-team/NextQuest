import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Charge le .env racine du monorepo pour les tests d'integration qui
// touchent a la BDD ou au cache. En CI, les vars sont injectees via
// secrets/env du workflow et dotenv ne fait rien (pas de fichier .env la-bas).
config({ path: "../../.env" });

// Les tests d'integration TRUNCATE les tables : on les isole systematiquement
// sur une base dediee "<db>_test" pour ne jamais toucher la base de dev.
// En CI, DATABASE_URL pointe deja sur nextquest_test (suffixe deja present,
// on ne double donc pas). Le suffixe se pose une seule fois.
if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);
  const dbName = url.pathname.replace(/^\//, "");
  if (dbName && !dbName.endsWith("_test")) {
    url.pathname = `/${dbName}_test`;
    process.env.DATABASE_URL = url.toString();
  }
}

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    // Preflight : echoue vite avec un message clair si Postgres est injoignable,
    // au lieu de laisser les tests pendre 10 min sur le handshake TCP (#64).
    globalSetup: ["./vitest.global-setup.ts"],
    // Tests partagent la meme BDD : forcer une execution sequentielle
    // pour eviter les conflits de cleanup entre fichiers
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    fileParallelism: false,
    // BDD Postgres en reseau Tailscale necessite plus de 10s
    hookTimeout: 30000,
  },
});

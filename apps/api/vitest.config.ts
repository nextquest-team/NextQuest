import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Charge le .env racine du monorepo pour les tests d'integration qui
// touchent a la BDD ou au cache. En CI, les vars sont injectees via
// secrets/env du workflow et dotenv ne fait rien (pas de fichier .env la-bas).
config({ path: "../../.env" });

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
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

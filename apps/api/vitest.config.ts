import { defineConfig } from "vitest/config";

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
  },
});

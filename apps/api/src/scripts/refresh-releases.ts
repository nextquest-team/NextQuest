// Run manuel du rafraichissement des sorties (E2E, rattrapage, debug).
// Usage : pnpm --filter @nextquest/api refresh:releases
import { config } from "dotenv";
config({ path: "../../.env" });

import { refreshUpcomingReleases } from "../modules/games/refresh/release-refresh.service.js";

const summary = await refreshUpcomingReleases();
console.log(
  `Refresh sorties : ${summary.checked} verifies, ${summary.updated} mis a jour, ${summary.failedBatches} batchs en echec, ${summary.failedGames} jeux en echec`,
);
// Code 1 des qu'un batch IGDB ou un jeu individuel a echoue : le cron (verrou Redis)
// et le run manuel doivent tous les deux remonter l'echec au superviseur/CLI.
process.exit(summary.failedBatches > 0 || summary.failedGames > 0 ? 1 : 0);

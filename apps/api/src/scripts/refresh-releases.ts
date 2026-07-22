// Run manuel du rafraichissement des sorties (E2E, rattrapage, debug).
// Usage : pnpm --filter @nextquest/api refresh:releases
import { config } from "dotenv";
config({ path: "../../.env" });

import { refreshUpcomingReleases } from "../modules/games/refresh/release-refresh.service.js";

const summary = await refreshUpcomingReleases();
console.log(
  `Refresh sorties : ${summary.checked} verifies, ${summary.updated} mis a jour, ${summary.failedBatches} batchs en echec`,
);
process.exit(summary.failedBatches > 0 ? 1 : 0);

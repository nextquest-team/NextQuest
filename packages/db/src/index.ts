// Point d'entree unique du package : les consumers importent tout depuis @nextquest/db
export { db } from "./client.js";
export type { Database } from "./client.js";
export { assertDbReachable } from "./health.js";
export * from "./schema/index.js";

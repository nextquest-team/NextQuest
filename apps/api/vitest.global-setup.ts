import { config } from "dotenv";
config({ path: "../../.env" });
import { assertDbReachable } from "@nextquest/db";

// Preflight exécuté une fois avant toute la suite : on vérifie que Postgres répond.
// Si le host est injoignable (stack Docker éteinte, Tailscale coupé), on échoue en
// ~3s avec un message clair au lieu de laisser les tests d'intégration pendre
// indéfiniment sur le handshake TCP. Voir issue #64.
export default async function setup() {
  await assertDbReachable(process.env.DATABASE_URL, 3);
}

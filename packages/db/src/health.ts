import postgres from "postgres";

// Extrait "host:port" d'une URL Postgres pour un message d'erreur lisible.
function hostFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || "5432"}`;
  } catch {
    return "(URL invalide)";
  }
}

// Vérifie que Postgres répond, avec un timeout de connexion court. Sert de preflight
// aux tests (globalSetup vitest) : quand le host est injoignable (stack Docker éteinte,
// Tailscale coupé), on échoue en quelques secondes avec un message clair au lieu de
// pendre indéfiniment sur le handshake TCP. Voir issue #64.
export async function assertDbReachable(
  url: string = process.env.DATABASE_URL ?? "",
  timeoutSeconds = 3,
): Promise<void> {
  if (!url) throw new Error("DATABASE_URL is not set");
  // Client jetable dédié au preflight : connect_timeout court + une seule connexion.
  const sql = postgres(url, {
    connect_timeout: timeoutSeconds,
    max: 1,
    onnotice: () => {},
  });
  try {
    await sql`select 1`;
  } catch (err) {
    throw new Error(
      `BDD injoignable sur ${hostFromUrl(url)} — lance la stack Docker (pnpm docker:up). Détail: ${(err as Error).message}`,
    );
  } finally {
    // timeout 0 = on détruit la connexion tout de suite, sans attendre un drain
    // (inutile si le host ne répond pas).
    await sql.end({ timeout: 0 }).catch(() => {});
  }
}

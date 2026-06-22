import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

// Initialisation lazy : la connexion n'est creee qu'au premier acces
// Le Proxy permet d'exporter `db` comme un objet utilisable directement
// sans forcer l'appelant a gerer l'init manuellement
let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    // En env de test, on borne le handshake TCP (connect_timeout) pour échouer vite
    // quand le host est injoignable plutôt que de pendre indéfiniment (#64). En prod,
    // on garde le comportement par défaut (retry, pas de timeout court).
    const isTest =
      process.env.VITEST === "true" || process.env.NODE_ENV === "test";
    const client = postgres(url, isTest ? { connect_timeout: 3 } : {});
    _db = drizzle(client, { schema });
  }
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_, prop) {
    return (getDb() as any)[prop];
  },
});

export type Database = ReturnType<typeof drizzle>;

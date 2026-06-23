// Resilience connexion : la BDD peut couper un socket TCP reste inactif pendant
// une operation longue (ex. enrichissement IGDB qui attend le reseau plusieurs
// dizaines de secondes entre deux ecritures). En dev, le chemin Mac -> Tailscale
// -> NAT Docker Desktop est particulierement sujet a ce reaping de connexions
// inactives ; en prod, un blip reseau transitoire produit le meme symptome.
//
// postgres.js rouvre une connexion a la requete suivante : un simple retry de
// l'operation (idempotente) suffit a absorber la coupure. On ne retente QUE les
// erreurs de connexion transitoires ; une vraie erreur SQL remonte tout de suite.

const TRANSIENT_CONNECTION_CODES = new Set([
  "CONNECTION_CLOSED",
  "CONNECTION_ENDED",
  "CONNECTION_DESTROYED",
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
]);

export function isTransientConnectionError(err: unknown): boolean {
  const code =
    (err as { code?: string } | null)?.code ??
    (err as { cause?: { code?: string } } | null)?.cause?.code;
  return code != null && TRANSIENT_CONNECTION_CODES.has(code);
}

export interface DbRetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  // Injectable pour les tests (evite d'attendre reellement le backoff).
  sleep?: (ms: number) => Promise<void>;
}

// Execute `fn`, en le retentant sur erreur de connexion transitoire (backoff
// lineaire). Rejette immediatement toute autre erreur, et propage la derniere
// erreur si toutes les tentatives echouent.
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  opts: DbRetryOptions = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 200;
  const sleep =
    opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientConnectionError(err) || attempt === attempts) throw err;
      await sleep(baseDelayMs * attempt);
    }
  }
  throw lastErr;
}

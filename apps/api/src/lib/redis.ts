import Redis from "ioredis";

// Initialisation lazy : la connexion n'est creee qu'au premier acces.
// Le Proxy permet d'exporter `redis` comme un objet utilisable directement
// sans forcer l'appelant a gerer l'init manuellement. Evite d'ouvrir une
// connexion Redis quand le process n'en a pas besoin (ex. certains tests unitaires).
let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL is not set");
    _redis = new Redis(url, { maxRetriesPerRequest: 3 });
  }
  return _redis;
}

export const redis = new Proxy({} as Redis, {
  get(_, prop) {
    return (getRedis() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

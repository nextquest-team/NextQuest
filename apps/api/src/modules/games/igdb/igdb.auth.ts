// Authentification IGDB : token applicatif obtenu via Twitch (client_credentials),
// mis en cache dans Redis. Une seule paire client_id/secret pour tout le service.

const TWITCH_TOKEN_URL =
  process.env.TWITCH_TOKEN_URL ?? "https://id.twitch.tv/oauth2/token";

export const TWITCH_TOKEN_CACHE_KEY = "igdb:twitch_token";

// Marge : on expire le cache avant Twitch pour ne jamais envoyer un token tout juste
// perime (l'horloge et la latence peuvent decaler).
const TTL_MARGIN_SECONDS = 24 * 60 * 60; // 1 jour (expires_in ~ 60 jours)

type JsonFetchLike = (
  url: string,
  init?: { method?: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

interface TokenStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "EX", ttl: number): Promise<unknown>;
}

export async function getTwitchToken(
  clientId: string,
  clientSecret: string,
  store: TokenStore,
  fetchImpl: JsonFetchLike = fetch,
  tokenUrl: string = TWITCH_TOKEN_URL,
): Promise<string> {
  const cached = await store.get(TWITCH_TOKEN_CACHE_KEY);
  if (cached) return cached;

  const url = new URL(tokenUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("grant_type", "client_credentials");

  const res = await fetchImpl(url.toString(), { method: "POST" });
  if (!res.ok) {
    throw new Error(`Twitch OAuth a repondu HTTP ${res.status}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };

  const ttl = Math.max(60, data.expires_in - TTL_MARGIN_SECONDS);
  await store.set(TWITCH_TOKEN_CACHE_KEY, data.access_token, "EX", ttl);

  return data.access_token;
}

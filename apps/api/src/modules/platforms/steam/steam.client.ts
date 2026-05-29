// Wrapper minimal sur la Steam Web API. Une seule cle serveur (STEAM_API_KEY)
// sert pour tous les utilisateurs : on passe leur SteamID64 en parametre.

const STEAM_API_BASE = "https://api.steampowered.com";

type JsonFetchLike = (url: string) => Promise<{ json(): Promise<unknown> }>;

export interface SteamOwnedGame {
  appid: number;
  name: string;
  playtimeMinutes: number;
}

export interface SteamPlayerSummary {
  personaName: string;
  avatarUrl: string | null;
}

// Bibliotheque possedee. Tableau vide si le profil a ses details de jeu en prive.
export async function getOwnedGames(
  steamId: string,
  apiKey: string,
  fetchImpl: JsonFetchLike = fetch,
): Promise<SteamOwnedGame[]> {
  const url = new URL(`${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v1/`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("steamid", steamId);
  url.searchParams.set("include_appinfo", "1");
  url.searchParams.set("include_played_free_games", "1");
  url.searchParams.set("format", "json");

  const res = await fetchImpl(url.toString());
  const data = (await res.json()) as {
    response?: {
      games?: Array<{ appid: number; name: string; playtime_forever: number }>;
    };
  };

  return (data.response?.games ?? []).map((g) => ({
    appid: g.appid,
    name: g.name,
    playtimeMinutes: g.playtime_forever ?? 0,
  }));
}

// Profil public (pseudo + avatar) pour afficher le compte lie.
export async function getPlayerSummary(
  steamId: string,
  apiKey: string,
  fetchImpl: JsonFetchLike = fetch,
): Promise<SteamPlayerSummary | null> {
  const url = new URL(`${STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v2/`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("steamids", steamId);

  const res = await fetchImpl(url.toString());
  const data = (await res.json()) as {
    response?: { players?: Array<{ personaname: string; avatarfull?: string }> };
  };

  const player = data.response?.players?.[0];
  if (!player) return null;

  return {
    personaName: player.personaname,
    avatarUrl: player.avatarfull ?? null,
  };
}

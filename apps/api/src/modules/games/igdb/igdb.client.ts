// Wrapper sur l'API IGDB v4 (Apicalypse). Fonctions pures, fetch injectable pour les
// tests. Une requete = un appel ; le decoupage en lots de 500 et le throttling sont
// geres par le service appelant.

const IGDB_API_BASE = process.env.IGDB_API_BASE ?? "https://api.igdb.com/v4";

// Source Steam dans external_games. IGDB a remplace l'ancien champ `category` par
// `external_game_source` (l'ancien ne figure plus dans la reponse). Valeur confirmee
// empiriquement : Steam = 1 (ex. appid 1145360 -> jeu IGDB 113112).
export const STEAM_EXTERNAL_SOURCE = 1;

type JsonFetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface IgdbTaxon {
  igdbId: number;
  name: string;
  slug: string;
}

export interface IgdbGame {
  igdbId: number;
  name: string;
  summary: string | null;
  releaseDate: string | null; // YYYY-MM-DD
  rating: number | null;
  ratingCount: number | null;
  coverImageId: string | null;
  artworkImageId: string | null;
  developer: string | null;
  publisher: string | null;
  genres: IgdbTaxon[];
  themes: IgdbTaxon[];
  similarIgdbIds: number[];
  hypes: number | null;
}

export function igdbImageUrl(imageId: string, size: string): string {
  return `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg`;
}

async function igdbPost(
  endpoint: string,
  body: string,
  token: string,
  clientId: string,
  fetchImpl: JsonFetchLike,
): Promise<unknown> {
  const res = await fetchImpl(`${IGDB_API_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`IGDB ${endpoint} a repondu HTTP ${res.status}`);
  }
  return res.json();
}

// Map appid Steam -> id de jeu IGDB. Les appids absents d'IGDB ne figurent pas dans
// la map (gere comme "introuvable" cote service).
export async function findGameIdsBySteamAppids(
  appids: number[],
  token: string,
  clientId: string,
  fetchImpl: JsonFetchLike = fetch as unknown as JsonFetchLike,
): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  if (appids.length === 0) return result;

  const uidList = appids.map((a) => `"${a}"`).join(",");
  const body = `fields game,uid; where external_game_source = ${STEAM_EXTERNAL_SOURCE} & uid = (${uidList}); limit 500;`;

  const rows = (await igdbPost("external_games", body, token, clientId, fetchImpl)) as Array<{
    game?: number;
    uid?: string;
  }>;

  for (const row of rows) {
    if (row.game != null && row.uid != null) {
      result.set(Number(row.uid), row.game);
    }
  }
  return result;
}

const GAME_FIELDS = [
  "name",
  "summary",
  "first_release_date",
  "rating",
  "rating_count",
  "cover.image_id",
  "artworks.image_id",
  "genres.name",
  "genres.slug",
  "themes.name",
  "themes.slug",
  "involved_companies.company.name",
  "involved_companies.developer",
  "involved_companies.publisher",
  "similar_games",
  "hypes",
].join(",");

interface RawTaxon {
  id: number;
  name: string;
  slug: string;
}
interface RawGame {
  id: number;
  name: string;
  summary?: string;
  first_release_date?: number;
  rating?: number;
  rating_count?: number;
  cover?: { image_id?: string };
  artworks?: Array<{ image_id?: string }>;
  genres?: RawTaxon[];
  themes?: RawTaxon[];
  involved_companies?: Array<{
    company?: { name?: string };
    developer?: boolean;
    publisher?: boolean;
  }>;
  similar_games?: number[];
  hypes?: number;
}

function mapTaxa(raw: RawTaxon[] | undefined): IgdbTaxon[] {
  return (raw ?? []).map((t) => ({ igdbId: t.id, name: t.name, slug: t.slug }));
}

function unixToDate(unix: number | undefined): string | null {
  if (unix == null) return null;
  return new Date(unix * 1000).toISOString().slice(0, 10);
}

export async function fetchGamesByIds(
  igdbIds: number[],
  token: string,
  clientId: string,
  fetchImpl: JsonFetchLike = fetch as unknown as JsonFetchLike,
): Promise<IgdbGame[]> {
  if (igdbIds.length === 0) return [];

  const body = `fields ${GAME_FIELDS}; where id = (${igdbIds.join(",")}); limit 500;`;
  const rows = (await igdbPost("games", body, token, clientId, fetchImpl)) as RawGame[];

  return rows.map((r) => {
    const dev = r.involved_companies?.find((c) => c.developer)?.company?.name ?? null;
    const pub = r.involved_companies?.find((c) => c.publisher)?.company?.name ?? null;
    return {
      igdbId: r.id,
      name: r.name,
      summary: r.summary ?? null,
      releaseDate: unixToDate(r.first_release_date),
      rating: r.rating ?? null,
      ratingCount: r.rating_count ?? null,
      coverImageId: r.cover?.image_id ?? null,
      artworkImageId: r.artworks?.[0]?.image_id ?? null,
      developer: dev,
      publisher: pub,
      genres: mapTaxa(r.genres),
      themes: mapTaxa(r.themes),
      similarIgdbIds: r.similar_games ?? [],
      hypes: r.hypes ?? null,
    };
  });
}

// Durees de completion IGDB (game_time_to_beats). On ne garde que `normally`
// converti en minutes, et seulement si fiable (count >= 10) : la donnee brute
// contient des aberrations (ex. hastily 876h sur GTA Vice City).
export async function fetchTimeToBeats(
  igdbIds: number[],
  token: string,
  clientId: string,
  fetchImpl: JsonFetchLike = fetch as unknown as JsonFetchLike,
): Promise<Map<number, { normallyMinutes: number; count: number }>> {
  const map = new Map<number, { normallyMinutes: number; count: number }>();
  if (igdbIds.length === 0) return map;
  const body = `fields game_id,normally,count; where game_id = (${igdbIds.join(",")}); limit 500;`;
  const rows = (await igdbPost("game_time_to_beats", body, token, clientId, fetchImpl)) as Array<{
    game_id?: number;
    normally?: number;
    count?: number;
  }>;
  for (const row of rows) {
    if (row.game_id != null && row.normally != null && (row.count ?? 0) >= 10) {
      map.set(row.game_id, {
        normallyMinutes: Math.round(row.normally / 60),
        count: row.count ?? 0,
      });
    }
  }
  return map;
}

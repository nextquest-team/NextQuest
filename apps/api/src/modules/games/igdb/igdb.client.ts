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

export interface IgdbPlatform {
  igdbId: number;
  name: string;
  abbreviation: string | null;
}

export interface IgdbVideo {
  name: string | null;
  youtubeId: string; // id YouTube : le front construit l'embed
}

export interface IgdbWebsite {
  category: number; // enum IGDB (1=official, 13=steam, ...), interprete cote front
  url: string;
}

export interface IgdbSimilarGame {
  igdbId: number;
  name: string;
  coverImageId: string | null;
}

// Item de liste "a venir" : leger, mais avec genres+plateformes pour que le front
// construise ses filtres (timeline avec filtres, cf. feature #4).
export interface IgdbUpcomingGame {
  igdbId: number;
  name: string;
  releaseDate: string | null; // YYYY-MM-DD
  coverImageId: string | null;
  hypes: number | null;
  genres: IgdbTaxon[];
  platforms: IgdbPlatform[];
}

// Detail riche d'un jeu (page fiche). Recupere en un seul appel IGDB grace a
// l'expansion Apicalypse imbriquee (cover, screenshots, videos, similar.cover...).
export interface IgdbGameDetail {
  igdbId: number;
  name: string;
  summary: string | null;
  storyline: string | null;
  releaseDate: string | null; // YYYY-MM-DD
  rating: number | null;
  ratingCount: number | null;
  hypes: number | null;
  coverImageId: string | null;
  artworkImageId: string | null;
  screenshotImageIds: string[];
  videos: IgdbVideo[];
  developer: string | null;
  publisher: string | null;
  genres: IgdbTaxon[];
  themes: IgdbTaxon[];
  gameModes: IgdbTaxon[];
  playerPerspectives: IgdbTaxon[];
  platforms: IgdbPlatform[];
  websites: IgdbWebsite[];
  similarGames: IgdbSimilarGame[];
}

export interface UpcomingQuery {
  limit: number;
  offset: number;
  sort: "hype" | "date";
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

function mapRawGame(r: RawGame): IgdbGame {
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

  return rows.map(mapRawGame);
}

// Helper privé : exécute requête IGDB sur games et mappe le résultat en IgdbGame[].
async function requestIgdbGames(
  body: string,
  token: string,
  clientId: string,
  fetchImpl: JsonFetchLike = fetch as unknown as JsonFetchLike,
): Promise<IgdbGame[]> {
  const rows = (await igdbPost("games", body, token, clientId, fetchImpl)) as RawGame[];
  return rows.map(mapRawGame);
}

// Jeux pas encore sortis dans des genres donnes, tries par hype.
// nowEpochSeconds = timestamp Unix en secondes (eg. Math.floor(Date.now()/1000)).
export async function fetchUpcomingByGenres(
  igdbGenreIds: number[],
  nowEpochSeconds: number,
  token: string,
  clientId: string,
  fetchImpl: JsonFetchLike = fetch as unknown as JsonFetchLike,
): Promise<IgdbGame[]> {
  if (igdbGenreIds.length === 0) return [];
  const body = `fields ${GAME_FIELDS}; where first_release_date > ${nowEpochSeconds} & genres = (${igdbGenreIds.join(",")}); sort hypes desc; limit 60;`;
  return requestIgdbGames(body, token, clientId, fetchImpl);
}

// Jeux deja sortis, bien notes (assez de votes), dans des genres donnes. Tries par note.
// Sert d'epine dorsale a la Decouverte : du volume et de la pertinence meme sur petite biblio.
export async function fetchAcclaimedByGenres(
  igdbGenreIds: number[],
  nowEpochSeconds: number,
  token: string,
  clientId: string,
  fetchImpl: JsonFetchLike = fetch as unknown as JsonFetchLike,
): Promise<IgdbGame[]> {
  if (igdbGenreIds.length === 0) return [];
  const body =
    `fields ${GAME_FIELDS}; ` +
    `where first_release_date < ${nowEpochSeconds} & genres = (${igdbGenreIds.join(",")}) ` +
    `& rating_count >= 50 & rating >= 75; ` +
    `sort rating desc; limit 100;`;
  return requestIgdbGames(body, token, clientId, fetchImpl);
}

// Jeux developpes par un studio donne (resout la societe par nom puis interroge ses jeux).
// Sert a proposer "du meme studio" (ex. Larian -> Divinity) que le graphe similar IGDB ne donne pas.
export async function fetchGamesByDeveloper(
  developerName: string,
  token: string,
  clientId: string,
  fetchImpl: JsonFetchLike = fetch as unknown as JsonFetchLike,
): Promise<IgdbGame[]> {
  if (!developerName?.trim()) return [];

  // Echapper le nom du dev avant de l'injecter dans la requete IGDB (Apicalypse).
  // Backslash d'abord (sinon on doublerait les backslash ajoutes par l'echappement
  // des guillemets), puis les guillemets. Evite une injection via le nom du studio.
  const safe = developerName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  // 1. Resoudre la societe par nom exact, avec fallback : contient le texte.
  const companyRows = (await igdbPost(
    "companies",
    `fields id; where name = "${safe}"; limit 1;`,
    token,
    clientId,
    fetchImpl,
  )) as Array<{ id?: number }>;

  let companyId = companyRows?.[0]?.id;
  if (companyId == null) {
    // Fallback : recherche "contient"
    const alt = (await igdbPost(
      "companies",
      `fields id; where name ~ *"${safe}"*; limit 1;`,
      token,
      clientId,
      fetchImpl,
    )) as Array<{ id?: number }>;
    companyId = alt?.[0]?.id;
  }

  // Societe introuvable => retourner tableau vide sans appeler /games.
  if (companyId == null) return [];

  // 2. Jeux developpes par cette societe, sortis (rating_count >= 10), tries par note.
  const body =
    `fields ${GAME_FIELDS}; ` +
    `where involved_companies.company = ${companyId} & involved_companies.developer = true & rating_count >= 10; ` +
    `sort rating desc; limit 20;`;

  return requestIgdbGames(body, token, clientId, fetchImpl);
}

// Resultat leger de recherche par nom (autocomplete ajout manuel cote front).
// gameType/totalRatingCount/hypes servent au service pour filtrer les non-jeux
// (DLC, bundles...) et reclasser par popularite (cf. igdb.discovery.service.ts).
// Note : le champ IGDB `category` est deprecie et renvoie toujours null en
// pratique sur /games -- c'est `game_type` qu'il faut lire. Idem `follows`,
// toujours null : `total_rating_count` (+ `hypes` pour les jeux pas encore notes)
// est le seul signal de popularite fiable observe sur cet endpoint.
export interface IgdbSearchGame {
  igdbId: number;
  name: string;
  coverImageId: string | null;
  firstReleaseDate: number | null; // epoch secondes
  platformIds: number[]; // ids IGDB des plateformes sur lesquelles le jeu existe
  gameType: number | null; // enum IGDB game_type (0=main_game, 1=dlc, 3=bundle, ...)
  totalRatingCount: number | null; // nombre total d'avis, proxy de popularite
  hypes: number | null; // nombre d'anticipations, proxy de popularite pre-sortie
}

const SEARCH_FIELDS = "name,cover.image_id,first_release_date,platforms,game_type,total_rating_count,hypes";

interface RawSearchGame {
  id: number;
  name: string;
  cover?: { image_id?: string };
  first_release_date?: number;
  platforms?: number[];
  game_type?: number;
  total_rating_count?: number;
  hypes?: number;
}

// Recherche IGDB par nom (Apicalypse `search`, pas un filtre `where`). Nom echappe
// avant injection pour eviter une casse de la requete (memes regles que fetchGamesByDeveloper).
// `platforms` demande sans expansion (juste les ids) : le service mappe ensuite
// ces ids vers nos plateformes locales, pas besoin du nom/abbreviation IGDB ici.
// `limit` sert de taille de pool de candidats bruts au service appelant (qui filtre
// et reclasse ensuite), pas necessairement le nombre final renvoye au front.
export async function searchGamesByName(
  name: string,
  limit: number,
  token: string,
  clientId: string,
  fetchImpl: JsonFetchLike = fetch as unknown as JsonFetchLike,
): Promise<IgdbSearchGame[]> {
  const safe = name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const body = `search "${safe}"; fields ${SEARCH_FIELDS}; limit ${limit};`;
  const rows = (await igdbPost("games", body, token, clientId, fetchImpl)) as RawSearchGame[];
  return rows.map((r) => ({
    igdbId: r.id,
    name: r.name,
    coverImageId: r.cover?.image_id ?? null,
    firstReleaseDate: r.first_release_date ?? null,
    platformIds: r.platforms ?? [],
    gameType: r.game_type ?? null,
    totalRatingCount: r.total_rating_count ?? null,
    hypes: r.hypes ?? null,
  }));
}

interface RawPlatform {
  id: number;
  name: string;
  abbreviation?: string;
}

function mapPlatforms(raw: RawPlatform[] | undefined): IgdbPlatform[] {
  return (raw ?? []).map((p) => ({
    igdbId: p.id,
    name: p.name,
    abbreviation: p.abbreviation ?? null,
  }));
}

const UPCOMING_FIELDS = [
  "name",
  "first_release_date",
  "hypes",
  "cover.image_id",
  "genres.name",
  "genres.slug",
  "platforms.name",
  "platforms.abbreviation",
].join(",");

interface RawUpcomingGame {
  id: number;
  name: string;
  first_release_date?: number;
  hypes?: number;
  cover?: { image_id?: string };
  genres?: RawTaxon[];
  platforms?: RawPlatform[];
}

// Liste des jeux a venir (first_release_date > now). Tri par hype (anticipation,
// defaut) ou par date (timeline chronologique). Pagination limit/offset. Le proxy
// applicatif (igdb.discovery.service) cache la reponse en Redis.
export async function fetchUpcoming(
  opts: UpcomingQuery,
  nowEpochSeconds: number,
  token: string,
  clientId: string,
  fetchImpl: JsonFetchLike = fetch as unknown as JsonFetchLike,
): Promise<IgdbUpcomingGame[]> {
  const sort = opts.sort === "date" ? "first_release_date asc" : "hypes desc";
  const body =
    `fields ${UPCOMING_FIELDS}; ` +
    `where first_release_date > ${nowEpochSeconds}; ` +
    `sort ${sort}; limit ${opts.limit}; offset ${opts.offset};`;
  const rows = (await igdbPost("games", body, token, clientId, fetchImpl)) as RawUpcomingGame[];
  return rows.map((r) => ({
    igdbId: r.id,
    name: r.name,
    releaseDate: unixToDate(r.first_release_date),
    coverImageId: r.cover?.image_id ?? null,
    hypes: r.hypes ?? null,
    genres: mapTaxa(r.genres),
    platforms: mapPlatforms(r.platforms),
  }));
}

const DETAIL_FIELDS = [
  "name",
  "summary",
  "storyline",
  "first_release_date",
  "rating",
  "rating_count",
  "hypes",
  "cover.image_id",
  "artworks.image_id",
  "screenshots.image_id",
  "videos.video_id",
  "videos.name",
  "genres.name",
  "genres.slug",
  "themes.name",
  "themes.slug",
  "game_modes.name",
  "game_modes.slug",
  "player_perspectives.name",
  "player_perspectives.slug",
  "platforms.name",
  "platforms.abbreviation",
  "websites.category",
  "websites.url",
  "involved_companies.company.name",
  "involved_companies.developer",
  "involved_companies.publisher",
  "similar_games.name",
  "similar_games.cover.image_id",
].join(",");

interface RawVideo {
  video_id?: string;
  name?: string;
}
interface RawWebsite {
  category?: number;
  url?: string;
}
interface RawSimilar {
  id: number;
  name: string;
  cover?: { image_id?: string };
}
interface RawGameDetail {
  id: number;
  name: string;
  summary?: string;
  storyline?: string;
  first_release_date?: number;
  rating?: number;
  rating_count?: number;
  hypes?: number;
  cover?: { image_id?: string };
  artworks?: Array<{ image_id?: string }>;
  screenshots?: Array<{ image_id?: string }>;
  videos?: RawVideo[];
  genres?: RawTaxon[];
  themes?: RawTaxon[];
  game_modes?: RawTaxon[];
  player_perspectives?: RawTaxon[];
  platforms?: RawPlatform[];
  websites?: RawWebsite[];
  involved_companies?: Array<{
    company?: { name?: string };
    developer?: boolean;
    publisher?: boolean;
  }>;
  // Expanded (similar_games.name, .cover) -> objets, pas des ids bruts.
  similar_games?: RawSimilar[];
}

function mapGameDetail(r: RawGameDetail): IgdbGameDetail {
  const dev = r.involved_companies?.find((c) => c.developer)?.company?.name ?? null;
  const pub = r.involved_companies?.find((c) => c.publisher)?.company?.name ?? null;
  return {
    igdbId: r.id,
    name: r.name,
    summary: r.summary ?? null,
    storyline: r.storyline ?? null,
    releaseDate: unixToDate(r.first_release_date),
    rating: r.rating ?? null,
    ratingCount: r.rating_count ?? null,
    hypes: r.hypes ?? null,
    coverImageId: r.cover?.image_id ?? null,
    artworkImageId: r.artworks?.[0]?.image_id ?? null,
    screenshotImageIds: (r.screenshots ?? [])
      .map((s) => s.image_id)
      .filter((x): x is string => x != null),
    videos: (r.videos ?? [])
      .filter((v): v is { video_id: string; name?: string } => v.video_id != null)
      .map((v) => ({ name: v.name ?? null, youtubeId: v.video_id })),
    developer: dev,
    publisher: pub,
    genres: mapTaxa(r.genres),
    themes: mapTaxa(r.themes),
    gameModes: mapTaxa(r.game_modes),
    playerPerspectives: mapTaxa(r.player_perspectives),
    platforms: mapPlatforms(r.platforms),
    websites: (r.websites ?? [])
      .filter((w): w is { category: number; url: string } => w.category != null && w.url != null)
      .map((w) => ({ category: w.category, url: w.url })),
    similarGames: (r.similar_games ?? []).map((s) => ({
      igdbId: s.id,
      name: s.name,
      coverImageId: s.cover?.image_id ?? null,
    })),
  };
}

// Detail riche d'un jeu par son IGDB id. null si l'id est introuvable cote IGDB.
export async function fetchGameDetail(
  igdbId: number,
  token: string,
  clientId: string,
  fetchImpl: JsonFetchLike = fetch as unknown as JsonFetchLike,
): Promise<IgdbGameDetail | null> {
  const body = `fields ${DETAIL_FIELDS}; where id = ${igdbId}; limit 1;`;
  const rows = (await igdbPost("games", body, token, clientId, fetchImpl)) as RawGameDetail[];
  const row = rows[0];
  return row ? mapGameDetail(row) : null;
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

// Service de decouverte IGDB : proxy live + cache Redis (read-through).
// Sert le feed "a venir" et le detail d'un jeu sans persister en BDD (on hydrate
// le catalogue uniquement quand un user ajoute un jeu a sa collection).
// Deps injectables (token, client, cache, horloge) pour des tests sans Redis ni reseau.
import {
  fetchUpcoming,
  fetchGameDetail,
  fetchGamesByIds,
  fetchGamesByDeveloper,
  searchGamesByName,
  type UpcomingQuery,
  type IgdbGame,
} from "./igdb.client.js";
import { getTwitchToken } from "./igdb.auth.js";
import { redis } from "../../../lib/redis.js";
import { db, userGames, games, platforms } from "@nextquest/db";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import {
  toUpcomingGameDTO,
  toGameDetailDTO,
  toSearchResultDTO,
  type UpcomingGameDTO,
  type GameDetailDTO,
  type IgdbSearchResult,
  type IgdbSearchResultBase,
  type LocalPlatformRef,
} from "./igdb.dto.js";
import { sharesGenreOrTheme, contentSimilarity, normalizeGameTitle, type GameForSimilarity } from "../../recommendations/similarity.js";

// TTL : la liste "a venir" bouge peu (1h) ; le detail d'un jeu encore moins (24h).
// La recherche par nom partage le TTL "a venir" : resultats stables sur l'heure,
// evite de re-frapper IGDB a chaque frappe similaire cote autocomplete front.
const UPCOMING_TTL = 3600;
const DETAIL_TTL = 86400;
const SEARCH_TTL = 3600;

// Taille du pool de candidats bruts recupere aupres d'IGDB, avant filtrage par
// type et reclassement par pertinence/popularite (cf. rankAndFilterCandidates).
// La recherche IGDB brute est triee par pertinence texte pure : sans marge, des
// jeux connus se retrouvent noyes derriere des DLC/bundles/jeux obscurs.
const SEARCH_POOL_SIZE = 50;

// Categories IGDB "jeu jouable" conservees dans les resultats de recherche :
// main_game=0, standalone_expansion=4, remake=8, remaster=9, expanded_game=10, port=11.
// Exclues : dlc=1, expansion=2, bundle=3, mod=5, episode=6, season=7, fork=12, pack=13, update=14.
const SEARCHABLE_CATEGORIES = new Set([0, 4, 8, 9, 10, 11]);

// Tier de correspondance du nom vs la requete tapee : plus petit = meilleur match.
// Prime sur la popularite dans le tri final pour qu'un match exact ne soit jamais
// enterre sous un jeu plus populaire mais moins pertinent pour ce qui a ete tape.
function nameMatchTier(name: string, query: string): number {
  const n = name.trim().toLowerCase();
  const q = query.trim().toLowerCase();
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (n.includes(q)) return 2;
  return 3;
}

// Popularite = somme follows + total_rating_count, les deux signaux IGDB dispo
// sur la recherche par nom (pas de note moyenne fiable a ce stade, cf. rating_count
// sur fetchAcclaimedByGenres qui lui filtre deja par volume de votes).
function popularityScore(g: IgdbSearchResultBase): number {
  return (g.follows ?? 0) + (g.totalRatingCount ?? 0);
}

// Filtre les non-jeux (DLC/bundles/mods/...), classe par (tier de nom, popularite
// decroissante) et coupe au top `limit`. Un candidat sans category connue est
// garde par prudence plutot que perdu (IGDB ne renseigne pas toujours ce champ).
// Tri stable : a tier et score egaux, l'ordre de pertinence IGDB d'origine est conserve.
function rankAndFilterCandidates(
  candidates: IgdbSearchResultBase[],
  query: string,
  limit: number,
): IgdbSearchResultBase[] {
  return candidates
    .filter((g) => g.category == null || SEARCHABLE_CATEGORIES.has(g.category))
    .map((g, index) => ({ g, index, tier: nameMatchTier(g.name, query) }))
    .sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      const scoreDiff = popularityScore(b.g) - popularityScore(a.g);
      if (scoreDiff !== 0) return scoreDiff;
      return a.index - b.index;
    })
    .slice(0, limit)
    .map(({ g }) => g);
}

export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "EX", ttl: number): Promise<unknown>;
}

// Ligne brute renvoyee par la requete DB : garde igdbId pour construire la map
// de mapping cote appelant (LocalPlatformRef expose seulement id+name au front).
export type LocalPlatformWithIgdbId = LocalPlatformRef & { igdbId: number };

export interface DiscoveryDeps {
  getToken(): Promise<string>;
  fetchUpcoming: typeof fetchUpcoming;
  fetchGameDetail: typeof fetchGameDetail;
  fetchGamesByIds: typeof fetchGamesByIds;
  fetchGamesByDeveloper: typeof fetchGamesByDeveloper;
  searchGamesByName: typeof searchGamesByName;
  findOwnedIgdbIds(userId: string, igdbIds: number[]): Promise<Set<number>>;
  findPlatformsByIgdbIds(igdbIds: number[]): Promise<LocalPlatformWithIgdbId[]>;
  cache: CacheStore;
  now(): Date;
}

// Croise user_games <-> games.igdbId pour ce user, limite aux candidats de la
// recherche en cours. Source de verite "deja en collection" = user_games (pas un
// flag stocke sur `games`, qui est un catalogue partage entre users).
async function findOwnedIgdbIds(
  userId: string,
  igdbIds: number[],
): Promise<Set<number>> {
  if (igdbIds.length === 0) return new Set();
  const rows = await db
    .select({ igdbId: games.igdbId })
    .from(userGames)
    .innerJoin(games, eq(userGames.gameId, games.id))
    .where(and(eq(userGames.userId, userId), inArray(games.igdbId, igdbIds)));
  return new Set(
    rows.map((r) => r.igdbId).filter((id): id is number => id != null),
  );
}

// Mappe des ids de plateformes IGDB vers nos plateformes locales (une seule
// requete pour tous les resultats de la recherche en cours). Les plateformes
// sans igdb_id renseigne (ex: Steam Deck) ne peuvent jamais matcher, ce qui est
// le comportement voulu : on ne propose que ce qu'IGDB confirme pour ce jeu.
async function findPlatformsByIgdbIds(igdbIds: number[]): Promise<LocalPlatformWithIgdbId[]> {
  if (igdbIds.length === 0) return [];
  const rows = await db
    .select({ id: platforms.id, name: platforms.name, igdbId: platforms.igdbId })
    .from(platforms)
    .where(and(isNotNull(platforms.igdbId), inArray(platforms.igdbId, igdbIds)));
  return rows.filter((r): r is LocalPlatformWithIgdbId => r.igdbId != null);
}

export function defaultDiscoveryDeps(): DiscoveryDeps {
  // Forme reduite de l'interface ioredis, suffisante ici et testable (mocks en test).
  const redisStore = redis as unknown as CacheStore & {
    get(k: string): Promise<string | null>;
    set(k: string, v: string, m: "EX", t: number): Promise<unknown>;
  };
  return {
    getToken: () =>
      getTwitchToken(
        process.env.TWITCH_CLIENT_ID ?? "",
        process.env.TWITCH_CLIENT_SECRET ?? "",
        redisStore,
      ),
    fetchUpcoming,
    fetchGameDetail,
    fetchGamesByIds,
    fetchGamesByDeveloper,
    searchGamesByName,
    findOwnedIgdbIds,
    findPlatformsByIgdbIds,
    cache: redisStore,
    now: () => new Date(),
  };
}

export async function getUpcomingGames(
  opts: UpcomingQuery,
  clientId: string = process.env.TWITCH_CLIENT_ID ?? "",
  deps: DiscoveryDeps = defaultDiscoveryDeps(),
): Promise<UpcomingGameDTO[]> {
  const key = `igdb:upcoming:${opts.sort}:${opts.limit}:${opts.offset}`;
  const cached = await deps.cache.get(key);
  if (cached) return JSON.parse(cached) as UpcomingGameDTO[];

  const token = await deps.getToken();
  const nowEpoch = Math.floor(deps.now().getTime() / 1000);
  const games = await deps.fetchUpcoming(opts, nowEpoch, token, clientId);
  const dto = games.map(toUpcomingGameDTO);
  await deps.cache.set(key, JSON.stringify(dto), "EX", UPCOMING_TTL);
  return dto;
}

export async function getGameDetail(
  igdbId: number,
  clientId: string = process.env.TWITCH_CLIENT_ID ?? "",
  deps: DiscoveryDeps = defaultDiscoveryDeps(),
): Promise<GameDetailDTO | null> {
  const key = `igdb:game:${igdbId}`;
  const cached = await deps.cache.get(key);
  if (cached) return JSON.parse(cached) as GameDetailDTO;

  const token = await deps.getToken();
  const game = await deps.fetchGameDetail(igdbId, token, clientId);
  // On ne cache pas l'absence : un jeu peut apparaitre plus tard dans IGDB.
  if (!game) return null;

  // Charger les détails des similarGames IGDB pour permettre le re-ranking par similarité.
  // Si la requête échoue, on garde l'ordre IGDB en fallback.
  const similarGameDetails = new Map(
    (await deps.fetchGamesByIds(
      game.similarGames.map((s) => s.igdbId),
      token,
      clientId,
    ).catch(() => []))
      .map((g) => [g.igdbId, g]),
  );

  // Enrichir avec les jeux du meme developpeur (surfacer des pepites que IGDB ne liste pas).
  // Appliquer un plancher genre/theme : ne retenir un candidat meme-studio que s'il partage
  // au moins 1 genre OU 1 theme avec le jeu courant, pour exclure les cas "meme studio mais genre totalement different".
  // Appliquer un plafond : ne garder que top 3 par contentSimilarity au jeu courant,
  // apres dedup des re-editions (meme titre de base normalisé).
  // Fallback robuste : si l'appel échoue, garder la liste IGDB re-classée.
  if (game.developer) {
    try {
      const sameDeveloperGames = await deps.fetchGamesByDeveloper(
        game.developer,
        token,
        clientId,
      );
      const targetForFiltering: GameForSimilarity = {
        gameId: String(game.igdbId),
        genreIds: game.genres.map((g) => String(g.igdbId)),
        themeIds: game.themes.map((t) => String(t.igdbId)),
        developer: game.developer,
        publisher: game.publisher,
        igdbRating: game.rating,
      };

      // Etape 1 : filtrer par plancher genre/theme, puis dedup re-editions par meilleure similarite
      const filteredByGenre: GameForSimilarity[] = [];
      // titre normalisé -> { game, similarity } pour le meilleur candidat de ce titre
      const dedupByTitle = new Map<string, { game: IgdbGame; similarity: number }>();

      for (const sameDevGame of sameDeveloperGames) {
        // Exclure le jeu courant lui-même et eviter les doublons IGDB.
        if (sameDevGame.igdbId === game.igdbId || similarGameDetails.has(sameDevGame.igdbId)) {
          continue;
        }

        // Appliquer le plancher genre/theme
        const candidateForFiltering: GameForSimilarity = {
          gameId: String(sameDevGame.igdbId),
          genreIds: sameDevGame.genres.map((g) => String(g.igdbId)),
          themeIds: sameDevGame.themes.map((t) => String(t.igdbId)),
          developer: sameDevGame.developer,
          publisher: sameDevGame.publisher,
          igdbRating: sameDevGame.rating,
        };

        if (!sharesGenreOrTheme(targetForFiltering, candidateForFiltering)) {
          continue;
        }

        // Calculer la similarité de ce candidat au jeu courant
        const similarity = contentSimilarity(targetForFiltering, candidateForFiltering);

        // Dedup re-editions par titre normalisé : garder celui de meilleure similarite
        // (en cas d'égalité de similarité, départager par rating).
        const normalizedTitle = normalizeGameTitle(sameDevGame.name);
        const existing = dedupByTitle.get(normalizedTitle);
        if (
          !existing ||
          similarity > existing.similarity ||
          (similarity === existing.similarity && (sameDevGame.rating ?? 0) > (existing.game.rating ?? 0))
        ) {
          dedupByTitle.set(normalizedTitle, { game: sameDevGame, similarity });
        }

        filteredByGenre.push(candidateForFiltering);
      }

      // Etape 2 : plafonner a top 3 par contentSimilarity au jeu courant
      const uniqueByTitle = Array.from(dedupByTitle.values()).map(({ game, similarity }) => ({
        game,
        similarity,
      }));

      const topByGenreAndSim = uniqueByTitle
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 3)
        .map((item) => item.game);

      // Ajouter au map des similarites
      for (const sameDevGame of topByGenreAndSim) {
        similarGameDetails.set(sameDevGame.igdbId, sameDevGame);
      }
    } catch {
      // Echec silencieux : continuer avec la liste IGDB re-classée.
    }
  }

  const today = deps.now().toISOString().slice(0, 10);
  const dto = toGameDetailDTO(game, today, similarGameDetails);
  await deps.cache.set(key, JSON.stringify(dto), "EX", DETAIL_TTL);
  return dto;
}

// Recherche live par nom (autocomplete de l'ajout manuel cote front). Proxy IGDB +
// cache Redis court : la meme frappe redemandee dans l'heure ne re-tape pas le quota IGDB.
// Le cache ne stocke que la base (partageable entre users) : le flag "deja en
// collection" est calcule a chaque appel pour l'utilisateur courant, jamais cache.
export async function searchIgdbGames(
  query: string,
  userId: string,
  limit: number = 18,
  clientId: string = process.env.TWITCH_CLIENT_ID ?? "",
  deps: DiscoveryDeps = defaultDiscoveryDeps(),
): Promise<IgdbSearchResult[]> {
  const key = `igdb:search:${query}:${limit}`;
  const cached = await deps.cache.get(key);

  let pool: IgdbSearchResultBase[];
  if (cached) {
    pool = JSON.parse(cached) as IgdbSearchResultBase[];
  } else {
    const token = await deps.getToken();
    // Pool de candidats bruts (au-dela du `limit` demande), cache tel quel : le
    // filtrage/reclassement ci-dessous depend de la requete courante et n'est
    // jamais cache, seul le pool brut IGDB l'est.
    const foundGames = await deps.searchGamesByName(query, SEARCH_POOL_SIZE, token, clientId);
    pool = foundGames.map(toSearchResultDTO);
    await deps.cache.set(key, JSON.stringify(pool), "EX", SEARCH_TTL);
  }

  const base = rankAndFilterCandidates(pool, query, limit);

  const owned = await deps.findOwnedIgdbIds(
    userId,
    base.map((g) => g.igdbId),
  );

  // Mapping plateformes IGDB -> plateformes locales calcule apres lecture/ecriture
  // du cache (jamais cache lui-meme) : nos plateformes changent rarement, mais
  // rester a jour immediatement (ex: ajout d'un igdb_id) est plus correct qu'une
  // heure de latence, sans complexite supplementaire notable.
  const allPlatformIds = [...new Set(base.flatMap((g) => g.platformIds ?? []))];
  const localPlatforms = await deps.findPlatformsByIgdbIds(allPlatformIds);
  const platformsByIgdbId = new Map(localPlatforms.map((p) => [p.igdbId, { id: p.id, name: p.name }]));

  return base.map((g) => {
    const gamePlatforms = [
      ...new Map(
        (g.platformIds ?? [])
          .map((igdbId) => platformsByIgdbId.get(igdbId))
          .filter((p): p is LocalPlatformRef => p != null)
          .map((p) => [p.id, p] as const),
      ).values(),
    ].sort((a, b) => a.name.localeCompare(b.name));

    // category/follows/totalRatingCount ont servi au filtrage/classement plus haut,
    // jamais exposes au front : on construit IgdbSearchResult explicitement plutot
    // que par spread pour ne pas les laisser fuiter dans la reponse.
    return {
      igdbId: g.igdbId,
      name: g.name,
      coverUrl: g.coverUrl,
      releaseYear: g.releaseYear,
      alreadyInCollection: owned.has(g.igdbId),
      platforms: gamePlatforms,
    };
  });
}

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
import { db, userGames, games } from "@nextquest/db";
import { and, eq, inArray } from "drizzle-orm";
import {
  toUpcomingGameDTO,
  toGameDetailDTO,
  toSearchResultDTO,
  type UpcomingGameDTO,
  type GameDetailDTO,
  type IgdbSearchResult,
  type IgdbSearchResultBase,
} from "./igdb.dto.js";
import { sharesGenreOrTheme, contentSimilarity, normalizeGameTitle, type GameForSimilarity } from "../../recommendations/similarity.js";

// TTL : la liste "a venir" bouge peu (1h) ; le detail d'un jeu encore moins (24h).
// La recherche par nom partage le TTL "a venir" : resultats stables sur l'heure,
// evite de re-frapper IGDB a chaque frappe similaire cote autocomplete front.
const UPCOMING_TTL = 3600;
const DETAIL_TTL = 86400;
const SEARCH_TTL = 3600;

export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "EX", ttl: number): Promise<unknown>;
}

export interface DiscoveryDeps {
  getToken(): Promise<string>;
  fetchUpcoming: typeof fetchUpcoming;
  fetchGameDetail: typeof fetchGameDetail;
  fetchGamesByIds: typeof fetchGamesByIds;
  fetchGamesByDeveloper: typeof fetchGamesByDeveloper;
  searchGamesByName: typeof searchGamesByName;
  findOwnedIgdbIds(userId: string, igdbIds: number[]): Promise<Set<number>>;
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
  limit: number = 12,
  clientId: string = process.env.TWITCH_CLIENT_ID ?? "",
  deps: DiscoveryDeps = defaultDiscoveryDeps(),
): Promise<IgdbSearchResult[]> {
  const key = `igdb:search:${query}:${limit}`;
  const cached = await deps.cache.get(key);

  let base: IgdbSearchResultBase[];
  if (cached) {
    base = JSON.parse(cached) as IgdbSearchResultBase[];
  } else {
    const token = await deps.getToken();
    const foundGames = await deps.searchGamesByName(query, limit, token, clientId);
    base = foundGames.map(toSearchResultDTO);
    await deps.cache.set(key, JSON.stringify(base), "EX", SEARCH_TTL);
  }

  const owned = await deps.findOwnedIgdbIds(
    userId,
    base.map((g) => g.igdbId),
  );
  return base.map((g) => ({ ...g, alreadyInCollection: owned.has(g.igdbId) }));
}

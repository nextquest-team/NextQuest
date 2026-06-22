// Service de decouverte IGDB : proxy live + cache Redis (read-through).
// Sert le feed "a venir" et le detail d'un jeu sans persister en BDD (on hydrate
// le catalogue uniquement quand un user ajoute un jeu a sa collection).
// Deps injectables (token, client, cache, horloge) pour des tests sans Redis ni reseau.
import {
  fetchUpcoming,
  fetchGameDetail,
  type UpcomingQuery,
} from "./igdb.client.js";
import { getTwitchToken } from "./igdb.auth.js";
import { redis } from "../../../lib/redis.js";
import {
  toUpcomingGameDTO,
  toGameDetailDTO,
  type UpcomingGameDTO,
  type GameDetailDTO,
} from "./igdb.dto.js";

// TTL : la liste "a venir" bouge peu (1h) ; le detail d'un jeu encore moins (24h).
const UPCOMING_TTL = 3600;
const DETAIL_TTL = 86400;

export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "EX", ttl: number): Promise<unknown>;
}

export interface DiscoveryDeps {
  getToken(): Promise<string>;
  fetchUpcoming: typeof fetchUpcoming;
  fetchGameDetail: typeof fetchGameDetail;
  cache: CacheStore;
  now(): Date;
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

  const today = deps.now().toISOString().slice(0, 10);
  const dto = toGameDetailDTO(game, today);
  await deps.cache.set(key, JSON.stringify(dto), "EX", DETAIL_TTL);
  return dto;
}

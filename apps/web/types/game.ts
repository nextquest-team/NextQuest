export type GameStatus = 'backlog' | 'playing' | 'completed' | 'abandoned'

export interface UpcomingGameDTO {
  igdbId: number
  title: string
  coverUrl: string | null
}

// ── Types API (collection.dto.ts côté API) ───────────────

export interface CollectionGameMeta {
  id: string
  title: string
  slug: string
  coverUrl: string | null
  backgroundUrl: string | null
  releaseDate: string | null
  developer: string | null
  publisher: string | null
  igdbRating: number | null
  igdbId: number | null
  isEnriched: boolean
}

// ── Types IGDB proxy (igdb.dto.ts côté API) ──────────────

export interface IgdbTaxonRef {
  igdbId: number
  name: string
  slug: string
}

export interface IgdbPlatformRef {
  igdbId: number
  name: string
  abbreviation: string | null
}

export interface IgdbVideoRef {
  name: string | null
  youtubeId: string
}

export interface IgdbSimilarGame {
  igdbId: number
  title: string
  coverUrl: string | null
}

// Aperçu partiel posé en cache (RecoCard, TimelineGameCard) avant navigation
// vers /games/catalog/:igdbId, pour un affichage instantané en attendant le
// fetch complet de IgdbGameDetail.
export type CatalogPreview = Partial<Omit<IgdbGameDetail, 'igdbId'>> & { igdbId: number }

export interface IgdbGameDetail {
  igdbId: number
  title: string
  summary: string | null
  storyline: string | null
  releaseDate: string | null
  releaseStatus: 'upcoming' | 'released'
  coverUrl: string | null
  artworkUrl: string | null
  screenshots: string[]
  videos: IgdbVideoRef[]
  rating: number | null
  ratingCount: number | null
  hypes: number | null
  developer: string | null
  publisher: string | null
  genres: IgdbTaxonRef[]
  themes: IgdbTaxonRef[]
  gameModes: IgdbTaxonRef[]
  playerPerspectives: IgdbTaxonRef[]
  platforms: IgdbPlatformRef[]
  similarGames: IgdbSimilarGame[]
}

export interface GenreRef {
  id: string
  name: string
  slug: string
}

export interface TagRef {
  id: string
  name: string
  slug: string
}

export interface SimilarGameRef {
  id: string
  title: string
  coverUrl: string | null
  igdbId: number | null
}

export interface CollectionItemDTO {
  userGameId: string
  status: GameStatus
  playtimeMinutes: number | null
  rating: number | null
  review: string | null
  isHidden: boolean
  startedAt: string | null
  completedAt: string | null
  addedAt: string | null
  game: CollectionGameMeta
  genres: GenreRef[]
  tags: TagRef[]
}

export interface CollectionDetailDTO extends CollectionItemDTO {
  description: string | null
  similarGames: SimilarGameRef[]
}

export interface CollectionListResponse {
  items: CollectionItemDTO[]
  total: number
  limit: number
  offset: number
}

// ── Plateformes (referentiel, GET /api/platforms) ───────

export interface Platform {
  id: string
  name: string
  code: string
  iconUrl: string | null
}

// ── Statut d'import Steam (GET /api/platforms/steam/import/status) ─

export interface ImportStatusGame {
  id: string
  coverUrl: string | null
  isEnriched: boolean
}

export interface ImportStatus {
  status: 'running' | 'done' | 'idle'
  total: number
  done: number
  games: ImportStatusGame[]
}

// ── Recherche live IGDB (GET /api/games/igdb/search) ─────

export interface IgdbSearchResult {
  igdbId: number
  name: string
  coverUrl: string | null
  releaseYear: number | null
  alreadyInCollection: boolean
  // Plateformes locales sur lesquelles le jeu existe (mappees depuis IGDB).
  platforms: { id: string; name: string }[]
}

// ── Type carte (interface allégée pour GameListCard) ─────

export interface UserGame {
  id: string       // = userGameId (user_games.id)
  gameId: string   // = game.id (games.id, pour l'éventuelle nav par jeu)
  title: string
  coverUrl: string | null
  status: GameStatus
  playtimeMinutes: number | null
}

export function toUserGame(item: CollectionItemDTO): UserGame {
  return {
    id: item.userGameId,
    gameId: item.game.id,
    title: item.game.title,
    coverUrl: item.game.coverUrl,
    status: item.status,
    playtimeMinutes: item.playtimeMinutes,
  }
}

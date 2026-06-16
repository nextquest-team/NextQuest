export type GameStatus = 'backlog' | 'playing' | 'completed' | 'abandoned'

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
  isEnriched: boolean
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

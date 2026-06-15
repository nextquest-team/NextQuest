export type GameStatus = 'backlog' | 'playing' | 'completed' | 'abandoned'

export interface UserGame {
  id: string
  gameId: string
  title: string
  coverUrl: string | null
  status: GameStatus
  playtimeMinutes?: number
}

export interface IgdbData {
  summary: string | null
  releaseDate: string | null
  developer: string | null
  publisher: string | null
  genres: string[]
  platforms: string[]
  igdbRating: number | null
}

export interface GameDetail extends UserGame {
  igdb: IgdbData | null
}

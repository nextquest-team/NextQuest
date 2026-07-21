import type { IgdbTaxonRef, IgdbPlatformRef } from '~/types/game'

export type TimelineTab = 'upcoming' | 'followed'

// Correspond a UpcomingGameDTO cote API (GET /api/games/upcoming)
export interface TimelineGameDTO {
  igdbId: number
  title: string
  releaseDate: string | null
  coverUrl: string | null
  hypes: number | null
  genres: IgdbTaxonRef[]
  platforms: IgdbPlatformRef[]
}

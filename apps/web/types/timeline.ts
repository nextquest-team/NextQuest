import type { IgdbTaxonRef, IgdbPlatformRef } from '~/types/game'

export type TimelineTab = 'upcoming' | 'followed'

// Correspond a UpcomingGameDTO cote API (GET /api/games/upcoming)
export interface TimelineGameDTO {
  igdbId: number
  title: string
  releaseDate: string | null
  // Present uniquement pour les resultats de recherche (GET /api/games/igdb/search
  // ?scope=upcoming) : ce DTO n'expose pas de date exacte, seulement l'annee.
  releaseYear?: number | null
  coverUrl: string | null
  hypes: number | null
  genres: IgdbTaxonRef[]
  platforms: IgdbPlatformRef[]
}

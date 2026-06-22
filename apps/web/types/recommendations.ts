import type { GenreRef } from './game'

export type RecoBucket = 'library_unplayed' | 'discovery' | 'upcoming'

export interface RecoGame {
  id: string
  title: string
  slug: string
  coverUrl: string | null
  releaseDate: string | null
  releaseStatus: string | null
  igdbRating: number | null
  genres: GenreRef[]
}

export interface RecoReason {
  text: string
  factors: Record<string, number>
}

export interface RecommendationDTO {
  id: string
  bucket: RecoBucket
  score: number
  reason: RecoReason
  game: RecoGame
}

export interface GroupedRecommendations {
  libraryUnplayed: RecommendationDTO[]
  discovery: RecommendationDTO[]
  upcoming: RecommendationDTO[]
}

export type FeedbackAction = 'liked' | 'dismissed' | 'added'

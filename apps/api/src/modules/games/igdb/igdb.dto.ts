// DTOs publics renvoyes par les routes de decouverte IGDB (feed "a venir" + detail).
// Construits a partir des shapes domaine du client (IgdbUpcomingGame / IgdbGameDetail) :
// le client normalise la reponse IGDB brute, ces mappers ajoutent la presentation
// (construction des URLs d'images, statut de sortie).
import {
  igdbImageUrl,
  type IgdbUpcomingGame,
  type IgdbGameDetail,
} from "./igdb.client.js";

export type TaxonRef = { igdbId: number; name: string; slug: string };
export type PlatformRef = {
  igdbId: number;
  name: string;
  abbreviation: string | null;
};

export type UpcomingGameDTO = {
  igdbId: number;
  title: string;
  releaseDate: string | null; // YYYY-MM-DD
  coverUrl: string | null;
  hypes: number | null;
  genres: TaxonRef[];
  platforms: PlatformRef[];
};

export type GameVideoDTO = { name: string | null; youtubeId: string };
export type GameWebsiteDTO = { category: number; url: string };
export type SimilarGameDTO = {
  igdbId: number;
  title: string;
  coverUrl: string | null;
};

export type GameDetailDTO = {
  igdbId: number;
  title: string;
  summary: string | null;
  storyline: string | null;
  releaseDate: string | null; // YYYY-MM-DD
  releaseStatus: "upcoming" | "released";
  coverUrl: string | null;
  artworkUrl: string | null;
  screenshots: string[];
  videos: GameVideoDTO[];
  rating: number | null;
  ratingCount: number | null;
  hypes: number | null;
  developer: string | null;
  publisher: string | null;
  genres: TaxonRef[];
  themes: TaxonRef[];
  gameModes: TaxonRef[];
  playerPerspectives: TaxonRef[];
  platforms: PlatformRef[];
  websites: GameWebsiteDTO[];
  similarGames: SimilarGameDTO[];
};

export function toUpcomingGameDTO(g: IgdbUpcomingGame): UpcomingGameDTO {
  return {
    igdbId: g.igdbId,
    title: g.name,
    releaseDate: g.releaseDate,
    coverUrl: g.coverImageId ? igdbImageUrl(g.coverImageId, "t_cover_big") : null,
    hypes: g.hypes,
    genres: g.genres,
    platforms: g.platforms,
  };
}

// `today` (YYYY-MM-DD) injecte par l'appelant pour rester deterministe/testable.
export function toGameDetailDTO(g: IgdbGameDetail, today: string): GameDetailDTO {
  const releaseStatus =
    g.releaseDate && g.releaseDate > today ? "upcoming" : "released";
  return {
    igdbId: g.igdbId,
    title: g.name,
    summary: g.summary,
    storyline: g.storyline,
    releaseDate: g.releaseDate,
    releaseStatus,
    coverUrl: g.coverImageId ? igdbImageUrl(g.coverImageId, "t_cover_big") : null,
    artworkUrl: g.artworkImageId ? igdbImageUrl(g.artworkImageId, "t_1080p") : null,
    screenshots: g.screenshotImageIds.map((id) =>
      igdbImageUrl(id, "t_screenshot_big"),
    ),
    videos: g.videos,
    rating: g.rating,
    ratingCount: g.ratingCount,
    hypes: g.hypes,
    developer: g.developer,
    publisher: g.publisher,
    genres: g.genres,
    themes: g.themes,
    gameModes: g.gameModes,
    playerPerspectives: g.playerPerspectives,
    platforms: g.platforms,
    websites: g.websites,
    similarGames: g.similarGames.map((s) => ({
      igdbId: s.igdbId,
      title: s.name,
      coverUrl: s.coverImageId ? igdbImageUrl(s.coverImageId, "t_cover_big") : null,
    })),
  };
}

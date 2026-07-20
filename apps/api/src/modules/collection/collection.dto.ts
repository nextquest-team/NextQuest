import type { userGames } from "@nextquest/db";
import type { InferSelectModel } from "drizzle-orm";
import { GAME_STATUSES, type GameStatus } from "./collection.schemas.js";

type UserGameRow = InferSelectModel<typeof userGames>;

// DTO renvoye au client apres un changement de statut.
export type UserGameStatusDTO = {
  id: string;
  status: GameStatus;
  startedAt: string | null; // date YYYY-MM-DD (colonne `date`)
  completedAt: string | null; // date YYYY-MM-DD
  updatedAt: string | null; // ISO 8601
};

// Garde-fou : la colonne BDD inclut `wishlist` (game_status_enum), exclu de
// GameStatus au MVP. Les flux qui produisent ces rows (import Steam, route de
// statut) ne posent jamais wishlist ; si la valeur sort de l'ensemble MVP c'est
// une violation de contrat, on casse proprement plutot que de laisser fuiter un
// statut non attendu vers le client.
function assertMvpStatus(status: string): GameStatus {
  if (!(GAME_STATUSES as readonly string[]).includes(status)) {
    throw new Error(`Statut hors MVP inattendu en base: ${status}`);
  }
  return status as GameStatus;
}

// Mappe les champs de statut d'une row user_games vers le DTO.
export function toUserGameStatusDTO(
  row: Pick<
    UserGameRow,
    "id" | "status" | "startedAt" | "completedAt" | "updatedAt"
  >,
): UserGameStatusDTO {
  return {
    id: row.id,
    status: assertMvpStatus(row.status),
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

// --- DTO de lecture de la collection (liste + detail) ---

export type GenreRef = { id: string; name: string; slug: string };
export type TagRef = { id: string; name: string; slug: string };
export type SimilarGameRef = {
  id: string;
  title: string;
  coverUrl: string | null;
};

export type CollectionGameMeta = {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  backgroundUrl: string | null;
  releaseDate: string | null;
  developer: string | null;
  publisher: string | null;
  igdbRating: number | null;
  // igdb_id brut : permet au front de recuperer le detail riche via
  // GET /games/igdb/:igdbId (clic sur un jeu de la collection). null = jeu custom
  // ou non enrichi, donc pas de detail IGDB disponible.
  igdbId: number | null;
  // True des qu'on a un igdb_id : le jeu a ete enrichi (description, genres, tags...).
  // Permet au front de signaler les jeux qui n'ont pas encore de metadonnees.
  isEnriched: boolean;
};

export type CollectionItemDTO = {
  userGameId: string;
  status: GameStatus;
  playtimeMinutes: number | null;
  rating: number | null;
  review: string | null;
  isHidden: boolean;
  startedAt: string | null; // date YYYY-MM-DD
  completedAt: string | null;
  addedAt: string | null; // ISO 8601 (user_games.createdAt)
  game: CollectionGameMeta;
  genres: GenreRef[];
  tags: TagRef[];
};

export type CollectionDetailDTO = CollectionItemDTO & {
  description: string | null;
  similarGames: SimilarGameRef[];
};

// Forme de la row jointe user_games + games attendue par les mappers.
// `description` n'est selectionne que pour le detail.
export type CollectionRow = {
  userGameId: string;
  status: string;
  playtimeMinutes: number | null;
  rating: number | null;
  review: string | null;
  isHidden: boolean;
  startedAt: string | null;
  completedAt: string | null;
  addedAt: Date | null;
  gameId: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  backgroundUrl: string | null;
  releaseDate: string | null;
  developer: string | null;
  publisher: string | null;
  igdbRating: number | null;
  igdbId: number | null;
  description?: string | null;
};

export function toCollectionItemDTO(
  row: CollectionRow,
  genres: GenreRef[],
  tags: TagRef[],
): CollectionItemDTO {
  return {
    userGameId: row.userGameId,
    status: assertMvpStatus(row.status),
    playtimeMinutes: row.playtimeMinutes,
    rating: row.rating,
    review: row.review,
    isHidden: row.isHidden,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    addedAt: row.addedAt ? row.addedAt.toISOString() : null,
    game: {
      id: row.gameId,
      title: row.title,
      slug: row.slug,
      coverUrl: row.coverUrl,
      backgroundUrl: row.backgroundUrl,
      releaseDate: row.releaseDate,
      developer: row.developer,
      publisher: row.publisher,
      igdbRating: row.igdbRating,
      igdbId: row.igdbId,
      isEnriched: row.igdbId !== null,
    },
    genres,
    tags,
  };
}

export function toCollectionDetailDTO(
  row: CollectionRow,
  genres: GenreRef[],
  tags: TagRef[],
  similarGames: SimilarGameRef[],
): CollectionDetailDTO {
  return {
    ...toCollectionItemDTO(row, genres, tags),
    description: row.description ?? null,
    similarGames,
  };
}

// --- DTO de la liste d'exclusion (jeux retires de la collection, non reimportes) ---

export type ExclusionDTO = {
  gameId: string;
  title: string;
  coverUrl: string | null;
  releaseDate: string | null;
  isEnriched: boolean;
  excludedAt: string; // ISO 8601
};

// Forme de la row jointe user_game_exclusions + games attendue par le mapper.
export type ExclusionRow = {
  gameId: string;
  title: string;
  coverUrl: string | null;
  releaseDate: string | null;
  igdbId: number | null;
  excludedAt: Date;
};

export function toExclusionDTO(row: ExclusionRow): ExclusionDTO {
  return {
    gameId: row.gameId,
    title: row.title,
    coverUrl: row.coverUrl,
    releaseDate: row.releaseDate,
    isEnriched: row.igdbId !== null,
    excludedAt: row.excludedAt.toISOString(),
  };
}

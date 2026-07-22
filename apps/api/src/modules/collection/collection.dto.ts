import type { userGames } from "@nextquest/db";
import type { InferSelectModel } from "drizzle-orm";
import { z } from "zod";
import { GAME_STATUSES, type GameStatus } from "./collection.schemas.js";

type UserGameRow = InferSelectModel<typeof userGames>;

// Schema de reponse apres un changement de statut. SOURCE UNIQUE DE VERITE :
// le type UserGameStatusDTO en est infere (z.infer).
export const userGameStatusSchema = z
  .object({
    id: z.uuid().describe("Identifiant de l'entree user_games"),
    status: z.enum(GAME_STATUSES).describe("Nouveau statut du jeu"),
    startedAt: z
      .string()
      .nullable()
      .describe(
        "Date de debut (YYYY-MM-DD), posee a la 1re transition vers playing",
      ),
    completedAt: z
      .string()
      .nullable()
      .describe(
        "Date de fin (YYYY-MM-DD), posee a la 1re transition vers completed",
      ),
    updatedAt: z
      .string()
      .nullable()
      .describe("Date de derniere modification (ISO 8601)"),
  })
  .describe("Resultat d'un changement de statut");

export type UserGameStatusDTO = z.infer<typeof userGameStatusSchema>;

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
// Schemas Zod SOURCE UNIQUE DE VERITE : chaque type xxxDTO est infere du
// schema correspondant, qui sert aussi a documenter/serialiser l'OpenAPI.

export const genreRefSchema = z
  .object({
    id: z.uuid().describe("Identifiant du genre"),
    name: z.string().describe("Nom du genre"),
    slug: z.string().describe("Slug du genre"),
  })
  .describe("Genre associe au jeu");
export type GenreRef = z.infer<typeof genreRefSchema>;

export const tagRefSchema = z
  .object({
    id: z.uuid().describe("Identifiant du tag"),
    name: z.string().describe("Nom du tag (theme IGDB)"),
    slug: z.string().describe("Slug du tag"),
  })
  .describe("Tag associe au jeu");
export type TagRef = z.infer<typeof tagRefSchema>;

export const similarGameRefSchema = z
  .object({
    id: z.uuid().describe("Identifiant interne du jeu similaire"),
    title: z.string().describe("Titre du jeu similaire"),
    coverUrl: z.string().nullable().describe("URL de la jaquette"),
    igdbId: z
      .number()
      .nullable()
      .describe("Identifiant IGDB : permet au front de lier vers /games/catalog/:igdbId"),
  })
  .describe("Jeu similaire (recommandation IGDB)");
export type SimilarGameRef = z.infer<typeof similarGameRefSchema>;

export const collectionGameMetaSchema = z
  .object({
    id: z.uuid().describe("Identifiant interne du jeu"),
    title: z.string().describe("Titre du jeu"),
    slug: z.string().describe("Slug du jeu"),
    coverUrl: z.string().nullable().describe("URL de la jaquette"),
    backgroundUrl: z.string().nullable().describe("URL de l'image de fond"),
    releaseDate: z.string().nullable().describe("Date de sortie (YYYY-MM-DD)"),
    developer: z.string().nullable().describe("Studio de developpement"),
    publisher: z.string().nullable().describe("Editeur"),
    igdbRating: z.number().nullable().describe("Note IGDB (0-100)"),
    igdbId: z
      .number()
      .nullable()
      .describe(
        "Identifiant IGDB brut : permet au front de recuperer le detail riche " +
          "via GET /games/igdb/:igdbId. null = jeu custom ou non enrichi",
      ),
    isEnriched: z
      .boolean()
      .describe(
        "True des qu'un igdb_id est present (jeu enrichi : description, genres, tags...)",
      ),
  })
  .describe("Metadonnees du jeu affichees dans la collection");
export type CollectionGameMeta = z.infer<typeof collectionGameMetaSchema>;

export const collectionItemSchema = z
  .object({
    userGameId: z.uuid().describe("Identifiant de l'entree user_games"),
    status: z.enum(GAME_STATUSES).describe("Statut courant du jeu"),
    playtimeMinutes: z
      .number()
      .nullable()
      .describe("Temps de jeu en minutes"),
    rating: z.number().nullable().describe("Note personnelle (1-10)"),
    review: z.string().nullable().describe("Avis personnel"),
    isHidden: z.boolean().describe("Jeu masque de l'affichage public"),
    startedAt: z.string().nullable().describe("Date de debut (YYYY-MM-DD)"),
    completedAt: z.string().nullable().describe("Date de fin (YYYY-MM-DD)"),
    addedAt: z
      .string()
      .nullable()
      .describe("Date d'ajout a la collection (ISO 8601)"),
    game: collectionGameMetaSchema,
    genres: z.array(genreRefSchema).describe("Genres du jeu"),
    tags: z.array(tagRefSchema).describe("Tags (themes IGDB) du jeu"),
  })
  .describe("Jeu de la collection de l'utilisateur");
export type CollectionItemDTO = z.infer<typeof collectionItemSchema>;

export const collectionDetailSchema = collectionItemSchema
  .extend({
    description: z.string().nullable().describe("Description du jeu"),
    similarGames: z
      .array(similarGameRefSchema)
      .describe("Jeux similaires (recommandations IGDB)"),
  })
  .describe("Detail d'un jeu de la collection (fiche complete)");
export type CollectionDetailDTO = z.infer<typeof collectionDetailSchema>;

// Reponse de GET /collection : page de resultats + total pour la pagination
// cote client. limit/offset sont echoes tels que resolus par la querystring
// (valeurs par defaut incluses), pas a deviner cote front.
export const listCollectionResultSchema = z
  .object({
    items: z.array(collectionItemSchema).describe("Jeux de la page courante"),
    total: z
      .number()
      .describe("Nombre total de jeux correspondant aux filtres"),
    limit: z.number().describe("Taille de page appliquee"),
    offset: z.number().describe("Decalage de pagination applique"),
  })
  .describe("Liste paginee de la collection");
export type ListCollectionResult = z.infer<typeof listCollectionResultSchema>;

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

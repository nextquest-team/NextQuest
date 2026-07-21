import { z } from "zod";
import type { Bucket, ScoreFactors } from "./scoring.js";

// Definie ici (et re-exportee par recommendations.schemas.ts) pour eviter un
// import circulaire : les schemas de reponse groupee/paginee de schemas.ts
// referencent recommendationDTOSchema, qui a lui-meme besoin de cet enum.
export const RECO_BUCKETS = [
  "library_unplayed",
  "discovery",
  "upcoming",
] as const;

// Explication "pourquoi" rule-based, sans LLM. Texte court à partir des facteurs.
// matchedGenres = noms des 1-2 genres réellement matchés dans le profil (fournis par generate.ts).
export function buildReason(bucket: Bucket, f: ScoreFactors, matchedGenres: string[] = []): string {
  const parts: string[] = [];
  if (f.matchG > 0.3) {
    const top = matchedGenres.slice(0, 2);
    parts.push(top.length ? `parce que tu aimes ${top.join(" et ")}` : "correspond à tes genres préférés");
  }
  if (f.quality > 0.7) parts.push("très bien noté");
  if (f.sim > 0.3) parts.push("proche de plusieurs de tes jeux");
  if (bucket === "library_unplayed") parts.push("dans ta biblio, jamais lancé");
  if (bucket === "upcoming") parts.push("sortie à venir très attendue");
  return parts.length ? parts.join(", ") : "suggestion basée sur tes goûts";
}

// --- DTO de lecture des recommandations. SOURCE UNIQUE DE VERITE : les types
// sont inferes des schemas Zod ci-dessous, qui documentent + serialisent les
// reponses OpenAPI (serializer Zod actif globalement).

export const genreRefSchema = z
  .object({
    id: z.uuid().describe("Identifiant du genre"),
    name: z.string().describe("Nom du genre"),
    slug: z.string().describe("Slug du genre"),
  })
  .describe("Genre associe a un jeu");

export type GenreRef = z.infer<typeof genreRefSchema>;

export const recommendationGameMetaSchema = z
  .object({
    id: z.uuid().describe("Identifiant du jeu"),
    title: z.string().describe("Titre du jeu"),
    slug: z.string().describe("Slug du jeu"),
    coverUrl: z.string().nullable().describe("URL de la jaquette"),
    releaseDate: z.string().nullable().describe("Date de sortie (ISO 8601)"),
    releaseStatus: z.string().nullable().describe("Statut de sortie (ex: released, upcoming)"),
    igdbRating: z.number().nullable().describe("Note IGDB (0-100)"),
    genres: z.array(genreRefSchema).describe("Genres du jeu"),
  })
  .describe("Metadonnees du jeu recommande");

export type RecommendationGameMeta = z.infer<typeof recommendationGameMetaSchema>;

export const recommendationReasonSchema = z
  .object({
    text: z.string().describe("Explication lisible de la recommandation"),
    factors: z.record(z.string(), z.number()).describe("Facteurs de score ayant produit la raison"),
  })
  .describe("Raison de la recommandation");

export type RecommendationReason = z.infer<typeof recommendationReasonSchema>;

export const recommendationDTOSchema = z
  .object({
    id: z.uuid().describe("Identifiant de la recommandation"),
    bucket: z.enum(RECO_BUCKETS).describe("Categorie de la recommandation"),
    score: z.number().describe("Score de pertinence (0-1)"),
    reason: recommendationReasonSchema,
    game: recommendationGameMetaSchema,
  })
  .describe("Recommandation de jeu");

export type RecommendationDTO = z.infer<typeof recommendationDTOSchema>;

export type RecommendationRow = {
  id: string;
  bucket: string;
  score: string | null;
  reason: unknown;
  gameId: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  releaseDate: string | null;
  releaseStatus: string | null;
  igdbRating: number | null;
};

function assertRecoBucket(bucket: string): RecommendationDTO["bucket"] {
  if (!(RECO_BUCKETS as readonly string[]).includes(bucket)) {
    throw new Error(`Bucket invalide: ${bucket}`);
  }
  return bucket as RecommendationDTO["bucket"];
}

export function toRecommendationDTO(
  row: RecommendationRow,
  genres: GenreRef[],
): RecommendationDTO {
  return {
    id: row.id,
    bucket: assertRecoBucket(row.bucket),
    score: parseFloat(row.score ?? "0"),
    reason: (row.reason as RecommendationReason) || {
      text: "suggestion basee sur tes gouts",
      factors: {},
    },
    game: {
      id: row.gameId,
      title: row.title,
      slug: row.slug,
      coverUrl: row.coverUrl,
      releaseDate: row.releaseDate,
      releaseStatus: row.releaseStatus,
      igdbRating: row.igdbRating,
      genres,
    },
  };
}

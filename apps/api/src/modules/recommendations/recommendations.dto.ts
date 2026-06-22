import type { Bucket, ScoreFactors } from "./scoring.js";
import type { RECO_BUCKETS } from "./recommendations.schemas.js";

// Explication "pourquoi" rule-based, sans LLM. Texte court a partir des facteurs.
export function buildReason(bucket: Bucket, f: ScoreFactors): string {
  const parts: string[] = [];
  if (f.matchG > 0.3) parts.push("correspond a tes genres preferes");
  if (f.quality > 0.7) parts.push("tres bien note");
  if (f.sim > 0.3) parts.push("proche de plusieurs de tes jeux");
  if (bucket === "library_unplayed") parts.push("dans ta biblio, jamais lance");
  if (bucket === "upcoming") parts.push("sortie a venir tres attendue");
  return parts.length ? parts.join(", ") : "suggestion basee sur tes gouts";
}

// --- DTO de lecture des recommandations ---

export type RecoBucketType = (typeof RECO_BUCKETS)[number];

export type GenreRef = { id: string; name: string; slug: string };

export type RecommendationGameMeta = {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  releaseDate: string | null;
  releaseStatus: string | null;
  igdbRating: number | null;
  genres: GenreRef[];
};

export type RecommendationReason = {
  text: string;
  factors: Record<string, number>;
};

export type RecommendationDTO = {
  id: string;
  bucket: RecoBucketType;
  score: number;
  reason: RecommendationReason;
  game: RecommendationGameMeta;
};

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

function assertRecoBucket(bucket: string): RecoBucketType {
  const valid = ["library_unplayed", "discovery", "upcoming"];
  if (!valid.includes(bucket)) {
    throw new Error(`Bucket invalide: ${bucket}`);
  }
  return bucket as RecoBucketType;
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

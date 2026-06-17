import type { Bucket, ScoreFactors } from "./scoring.js";

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

// Scoring additif, une formule parametree par bucket. Tout est pur.
export type Bucket = "library_unplayed" | "discovery" | "upcoming";

export type Candidate = {
  gameId: string;
  genreIds: string[];
  tagIds: string[];
  igdbRating: number | null; // 0-100
  igdbRatingCount: number | null;
  igdbHypes: number | null;
  similarVotes: number; // proximite ponderee (0 si non applicable)
};

export type ScoreFactors = {
  matchG: number;
  matchT: number;
  quality: number;
  sim: number;
};

// Maintenant que le match genre/tag discrimine (cosinus, non saturant),
// on revient a un equilibre genre/tag vs qualite vs similarite.
const BUCKET_WEIGHTS: Record<Bucket, { g: number; t: number; q: number; s: number }> = {
  library_unplayed: { g: 0.35, t: 0.25, q: 0.40, s: 0.0 },
  discovery: { g: 0.30, t: 0.20, q: 0.30, s: 0.20 },
  upcoming: { g: 0.35, t: 0.25, q: 0.25, s: 0.15 },
};
const QUALITY_PRIOR = 0.4;
const RATING_CONF_VOTES = 200;
const HYPE_REF = Math.log(500);
export const DISCOVERY_QUALITY_FLOOR = 0.35;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi);

// Similarite cosinus entre le vecteur de gout (profileNorm, restreint a un groupe)
// et le vecteur binaire du candidat (1 si le jeu a la dimension). Non saturante :
// un jeu qui partage plusieurs de tes genres dominants score plus haut qu'un qui
// n'en partage qu'un, sans plafonner a 1 pour tout le monde.
function cosineGroup(profileNorm: Map<string, number>, ids: string[], prefix: "g:" | "t:"): number {
  if (ids.length === 0) return 0;
  let dot = 0;
  for (const id of ids) dot += profileNorm.get(prefix + id) ?? 0;
  if (dot <= 0) return 0;
  let pSq = 0;
  for (const [k, v] of profileNorm) if (k.startsWith(prefix)) pSq += v * v;
  const denom = Math.sqrt(pSq) * Math.sqrt(ids.length);
  return denom > 0 ? clamp(dot / denom, 0, 1) : 0;
}

// Note joueurs ponderee par la confiance (nb de votes). Peu de votes -> prior bas,
// pour qu'un jeu de qualite inconnue ne batte pas une valeur sure.
export function ratingQuality(
  rating: number | null,
  ratingCount: number | null,
): number {
  if (rating == null) return QUALITY_PRIOR;
  const conf = clamp((ratingCount ?? 0) / RATING_CONF_VOTES, 0, 1);
  return (rating / 100) * conf + QUALITY_PRIOR * (1 - conf);
}

// Signal d'anticipation pour les jeux pas encore sortis (pas de note fiable).
export function hypeQuality(hypes: number | null): number {
  return clamp(Math.log1p(hypes ?? 0) / HYPE_REF, 0, 1);
}

export function scoreCandidate(
  profileNorm: Map<string, number>,
  c: Candidate,
  bucket: Bucket,
  maxSimilarVotes: number,
): { score: number; factors: ScoreFactors } {
  const w = BUCKET_WEIGHTS[bucket];
  const matchG = cosineGroup(profileNorm, c.genreIds, "g:");
  const matchT = cosineGroup(profileNorm, c.tagIds, "t:");
  const quality =
    bucket === "upcoming"
      ? hypeQuality(c.igdbHypes)
      : ratingQuality(c.igdbRating, c.igdbRatingCount);
  const sim = maxSimilarVotes > 0 ? c.similarVotes / maxSimilarVotes : 0;
  const score = w.g * matchG + w.t * matchT + w.q * quality + w.s * sim;
  return { score, factors: { matchG, matchT, quality, sim } };
}

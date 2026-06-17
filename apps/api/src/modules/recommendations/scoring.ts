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

// Genre/tag match sature a 1.0 sur une library fournie, donc on donne plus de budget
// de classement a la qualite qu'a la similarite, pour que les valeurs sures remontent
// au-dessus des jeux mediocres tres similaires.
const BUCKET_WEIGHTS: Record<Bucket, { g: number; t: number; q: number; s: number }> = {
  library_unplayed: { g: 0.30, t: 0.20, q: 0.50, s: 0.0 },
  discovery: { g: 0.25, t: 0.15, q: 0.45, s: 0.15 },
  upcoming: { g: 0.30, t: 0.20, q: 0.35, s: 0.15 },
};
const QUALITY_PRIOR = 0.4;
const RATING_CONF_VOTES = 200;
const HYPE_REF = Math.log(500);
export const DISCOVERY_QUALITY_FLOOR = 0.35;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

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
  const matchG = clamp(
    sum(c.genreIds.map((id) => profileNorm.get(`g:${id}`) ?? 0)),
    0,
    1,
  );
  const matchT = clamp(
    sum(c.tagIds.map((id) => profileNorm.get(`t:${id}`) ?? 0)),
    0,
    1,
  );
  const quality =
    bucket === "upcoming"
      ? hypeQuality(c.igdbHypes)
      : ratingQuality(c.igdbRating, c.igdbRatingCount);
  const sim = maxSimilarVotes > 0 ? c.similarVotes / maxSimilarVotes : 0;
  const score = w.g * matchG + w.t * matchT + w.q * quality + w.s * sim;
  return { score, factors: { matchG, matchT, quality, sim } };
}

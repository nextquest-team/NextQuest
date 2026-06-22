// Profil de gout : fonctions pures, sans I/O, testees isolement.
// Cle de dimension : "g:<genreId>" (genre) ou "t:<tagId>" (tag/theme IGDB).

export type ProfileVector = Map<string, number>;

export type OwnedGameForProfile = {
  gameId: string;
  status: string;
  playtimeMinutes: number | null;
  rating: number | null; // 1-10
  normallyMinutes: number | null; // duree IGDB "normally", deja en minutes
  ttbCount: number | null; // fiabilite de la duree
  genreIds: string[];
  tagIds: string[];
};

export type SwipeDelta = {
  feedback: "liked" | "dismissed" | "added";
  genreIds: string[];
  tagIds: string[];
};

// Poids par statut (signal explicite). abandoned negatif : on apprend des rejets.
const STATUS_WEIGHT: Record<string, number> = {
  completed: 1.0,
  playing: 0.8,
  backlog: 0.3,
  wishlist: 0.3,
  abandoned: -0.6,
};
const SWIPE_DELTA = 0.15;
const TTB_MIN_COUNT = 10;
const LOG_REF = Math.log(200); // normalisation du fallback log

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi);

function bump(v: ProfileVector, key: string, w: number) {
  v.set(key, (v.get(key) ?? 0) + w);
}

// Engagement : temps de jeu rapporte a la duree normale du jeu si fiable,
// sinon log(1+heures) amorti. Clamp a 1.5 pour qu'un seul jeu n'ecrase pas tout.
export function engagement(
  playtimeMinutes: number,
  normallyMinutes: number | null,
  ttbCount: number | null,
): number {
  if (normallyMinutes && normallyMinutes > 0 && (ttbCount ?? 0) >= TTB_MIN_COUNT) {
    return clamp(playtimeMinutes / normallyMinutes, 0, 1.5);
  }
  const hours = playtimeMinutes / 60;
  return clamp(Math.log1p(hours) / LOG_REF, 0, 1.5);
}

// Affinite d'un jeu possede : poidsStatut * engagement + ajustement de note (1-10).
export function affinity(g: OwnedGameForProfile): number {
  const sw = STATUS_WEIGHT[g.status] ?? 0;
  const eng = engagement(g.playtimeMinutes ?? 0, g.normallyMinutes, g.ttbCount);
  const ratingAdj = g.rating != null ? ((g.rating - 5.5) / 4.5) * 0.3 : 0;
  return sw * eng + ratingAdj;
}

// Vecteur brut (somme des affinites par dimension) pondere par l'IDF.
export function buildBaseProfile(
  owned: OwnedGameForProfile[],
  idf: Map<string, number>,
): ProfileVector {
  const raw: ProfileVector = new Map();
  for (const g of owned) {
    const a = affinity(g);
    for (const gid of g.genreIds) bump(raw, `g:${gid}`, a);
    for (const tid of g.tagIds) bump(raw, `t:${tid}`, a);
  }
  const weighted: ProfileVector = new Map();
  for (const [dim, val] of raw) weighted.set(dim, val * (idf.get(dim) ?? 1));
  return weighted;
}

// Apprentissage par swipe : chaque feedback nudge les dimensions du jeu swipe.
export function applySwipeDeltas(
  base: ProfileVector,
  swipes: SwipeDelta[],
): ProfileVector {
  const out = new Map(base);
  for (const s of swipes) {
    const sign = s.feedback === "dismissed" ? -1 : s.feedback === "added" ? 2 : 1;
    for (const gid of s.genreIds) bump(out, `g:${gid}`, sign * SWIPE_DELTA);
    for (const tid of s.tagIds) bump(out, `t:${tid}`, sign * SWIPE_DELTA);
  }
  return out;
}

// Normalise : le signal de plus forte amplitude vaut 1.
export function normalize(profile: ProfileVector): ProfileVector {
  let max = 0;
  for (const v of profile.values()) max = Math.max(max, Math.abs(v));
  if (max === 0) return new Map(profile);
  const out: ProfileVector = new Map();
  for (const [k, v] of profile) out.set(k, v / max);
  return out;
}

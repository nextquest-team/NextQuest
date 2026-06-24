// Normalise le titre d'un jeu pour detecter les re-editions du meme titre de base.
// Heuristique : minuscule, trim, retirer apres " - " (suffixes comme " - Definitive Edition",
// " - Enhanced Edition"), et normaliser les variantes type "II:" -> "II".
// Exemple : "Divinity: Original Sin 2 - Definitive Edition" -> "divinity: original sin 2"
export function normalizeGameTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .split(" - ")[0] // Retirer tout apres " - " (edition suffixes)
    .replace(/:\s+The\s+/, ": ") // Normaliser "II: The ..." -> "II: ..."
    .trim();
}

// Similarité de contenu entre deux jeux, rule-based (pas de LLM).
// Base : recouvrement genres + thèmes. Bonus (non filtrant) : même studio/éditeur.
export type GameForSimilarity = {
  gameId: string;
  genreIds: string[];
  themeIds: string[];
  developer: string | null;
  publisher: string | null;
  igdbRating: number | null;
};

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let inter = 0;
  for (const x of new Set(a)) if (setB.has(x)) inter++;
  const union = new Set([...a, ...b]).size;
  return union > 0 ? inter / union : 0;
}

// Verifie si deux jeux partagent au moins un genre OU un theme.
// Utilise Jaccard : une intersection non-vide => retourne true.
export function sharesGenreOrTheme(a: GameForSimilarity, b: GameForSimilarity): boolean {
  return jaccard(a.genreIds, b.genreIds) > 0 || jaccard(a.themeIds, b.themeIds) > 0;
}

// Poids de similarité de contenu. Les genres (RPG, Strategy, TBS) sont discriminants ;
// les thèmes IGDB (Action, Fantasy) sont grossiers et s'appliquent à des milliers de jeux.
// Donc genre pèse plus que thème pour un classement pertinent.
const W_GENRE = 0.55;
const W_THEME = 0.20;
const W_SAME_DEV = 0.20;
const W_SAME_PUB = 0.05;

export function contentSimilarity(a: GameForSimilarity, b: GameForSimilarity): number {
  const genre = jaccard(a.genreIds, b.genreIds);
  const theme = jaccard(a.themeIds, b.themeIds);
  const sameDev = a.developer && b.developer && a.developer === b.developer ? 1 : 0;
  const samePub = a.publisher && b.publisher && a.publisher === b.publisher ? 1 : 0;
  return W_GENRE * genre + W_THEME * theme + W_SAME_DEV * sameDev + W_SAME_PUB * samePub;
}

// Classe les candidats par similarité décroissante au jeu cible. Départage stable
// par note IGDB décroissante (le candidat le mieux noté passe devant à score égal).
export function rankBySimilarity(
  target: GameForSimilarity,
  candidates: GameForSimilarity[],
): GameForSimilarity[] {
  return [...candidates]
    .map((c) => ({ c, s: contentSimilarity(target, c), r: c.igdbRating ?? 0 }))
    .sort((x, y) => (y.s - x.s) || (y.r - x.r))
    .map((x) => x.c);
}

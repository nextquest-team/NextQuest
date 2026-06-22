// IDF (inverse document frequency) : donne du poids aux genres/tags distinctifs
// et ecrase les ubiquitaires (Action/Adventure sur la majorite du catalogue).
export function idf(totalGames: number, docFreq: number): number {
  return Math.log(totalGames / (1 + docFreq));
}

export function buildIdfMap(
  totalGames: number,
  freqs: { dimension: string; freq: number }[],
): Map<string, number> {
  const m = new Map<string, number>();
  for (const f of freqs) m.set(f.dimension, idf(totalGames, f.freq));
  return m;
}

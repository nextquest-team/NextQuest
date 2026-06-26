// Réordonne une liste déjà triée par score décroissant pour éviter d'empiler le
// même genre dominant. Greedy : on prend le meilleur item dont le genre dominant
// n'a pas dépassé maxPerGenre parmi les items déjà placés ; sinon on le diffère.
export type Diversifiable = { gameId: string; score: number; dominantGenreId: string | null };

export function diversify<T extends Diversifiable>(items: T[], maxPerGenre: number): T[] {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  const out: T[] = [];
  const deferred: T[] = [];
  const counts = new Map<string, number>();
  for (const it of sorted) {
    const g = it.dominantGenreId;
    if (g == null) { out.push(it); continue; }
    const n = counts.get(g) ?? 0;
    if (n < maxPerGenre) {
      out.push(it);
      counts.set(g, n + 1);
    } else {
      deferred.push(it);
    }
  }
  return [...out, ...deferred];
}

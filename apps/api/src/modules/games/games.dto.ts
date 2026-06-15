// Resume d'un jeu du catalogue, renvoye par la recherche (ajout manuel).
export type GameSummaryDTO = {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  releaseDate: string | null;
  isEnriched: boolean;
};

import { db, genres } from "@nextquest/db";

export type GenreRefDTO = {
  id: string;
  igdbId: number | null;
  name: string;
  slug: string;
};

// Referentiel des genres IGDB (RPG, Plateforme, FPS...) : alimente le filtre
// genres cote front et le moteur de recommandations.
export async function listGenres(): Promise<GenreRefDTO[]> {
  return db
    .select({ id: genres.id, igdbId: genres.igdbId, name: genres.name, slug: genres.slug })
    .from(genres)
    .orderBy(genres.name);
}

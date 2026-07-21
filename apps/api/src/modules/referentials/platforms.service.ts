import { db, platforms } from "@nextquest/db";

export type PlatformRefDTO = {
  id: string;
  name: string;
  code: string;
  iconUrl: string | null;
};

// Referentiel des plateformes (PS5, Switch, PC...) : alimente le selecteur
// de plateformes cote front lors de l'import/ajout manuel d'un jeu.
export async function listPlatforms(): Promise<PlatformRefDTO[]> {
  return db
    .select({
      id: platforms.id,
      name: platforms.name,
      code: platforms.code,
      iconUrl: platforms.iconUrl,
    })
    .from(platforms)
    .orderBy(platforms.name);
}

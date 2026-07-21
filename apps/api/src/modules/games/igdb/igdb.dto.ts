// DTOs publics renvoyes par les routes de decouverte IGDB (feed "a venir" + detail
// + recherche). SOURCE UNIQUE DE VERITE : les types sont inferes des schemas Zod
// ci-dessous, qui documentent + serialisent les reponses OpenAPI (serializer Zod
// actif globalement). Construits a partir des shapes domaine du client
// (IgdbUpcomingGame / IgdbGameDetail) : le client normalise la reponse IGDB brute,
// ces mappers ajoutent la presentation (construction des URLs d'images, statut de
// sortie).
import { z } from "zod";
import {
  igdbImageUrl,
  type IgdbUpcomingGame,
  type IgdbGameDetail,
  type IgdbGame,
  type IgdbSimilarGame,
  type IgdbSearchGame,
} from "./igdb.client.js";
import { rankBySimilarity, type GameForSimilarity } from "../../recommendations/similarity.js";

export const taxonRefSchema = z
  .object({
    igdbId: z.number().int().describe("Identifiant IGDB"),
    name: z.string().describe("Nom"),
    slug: z.string().describe("Slug"),
  })
  .describe("Reference a un genre/theme/mode de jeu/perspective IGDB");
export type TaxonRef = z.infer<typeof taxonRefSchema>;

export const platformRefSchema = z
  .object({
    igdbId: z.number().int().describe("Identifiant IGDB de la plateforme"),
    name: z.string().describe("Nom de la plateforme"),
    abbreviation: z.string().nullable().describe("Abreviation (ex: PS5)"),
  })
  .describe("Plateforme IGDB");
export type PlatformRef = z.infer<typeof platformRefSchema>;

export const upcomingGameDTOSchema = z
  .object({
    igdbId: z.number().int().describe("Identifiant IGDB du jeu"),
    title: z.string().describe("Titre du jeu"),
    releaseDate: z.string().nullable().describe("Date de sortie (YYYY-MM-DD)"),
    coverUrl: z.string().nullable().describe("URL de la jaquette"),
    hypes: z.number().int().nullable().describe("Nombre d'anticipations IGDB"),
    genres: z.array(taxonRefSchema).describe("Genres du jeu"),
    platforms: z.array(platformRefSchema).describe("Plateformes du jeu"),
  })
  .describe("Jeu a venir (feed decouverte)");
export type UpcomingGameDTO = z.infer<typeof upcomingGameDTOSchema>;

export const gameVideoDTOSchema = z
  .object({
    name: z.string().nullable().describe("Titre de la video"),
    youtubeId: z.string().describe("Identifiant YouTube (le front construit l'embed)"),
  })
  .describe("Video associee a un jeu");
export type GameVideoDTO = z.infer<typeof gameVideoDTOSchema>;

export const gameWebsiteDTOSchema = z
  .object({
    category: z.number().int().describe("Categorie IGDB du site (1=officiel, 13=Steam, ...), interpretee cote front"),
    url: z.string().describe("URL du site"),
  })
  .describe("Site web associe a un jeu");
export type GameWebsiteDTO = z.infer<typeof gameWebsiteDTOSchema>;

export const similarGameDTOSchema = z
  .object({
    igdbId: z.number().int().describe("Identifiant IGDB du jeu similaire"),
    title: z.string().describe("Titre du jeu similaire"),
    coverUrl: z.string().nullable().describe("URL de la jaquette"),
  })
  .describe("Jeu similaire");
export type SimilarGameDTO = z.infer<typeof similarGameDTOSchema>;

export const gameDetailDTOSchema = z
  .object({
    igdbId: z.number().int().describe("Identifiant IGDB du jeu"),
    title: z.string().describe("Titre du jeu"),
    summary: z.string().nullable().describe("Resume court"),
    storyline: z.string().nullable().describe("Trame narrative"),
    releaseDate: z.string().nullable().describe("Date de sortie (YYYY-MM-DD)"),
    releaseStatus: z
      .enum(["upcoming", "released"])
      .describe("Statut de sortie, calcule par rapport a la date du jour"),
    coverUrl: z.string().nullable().describe("URL de la jaquette"),
    artworkUrl: z.string().nullable().describe("URL de l'illustration"),
    screenshots: z.array(z.string()).describe("URLs des captures d'ecran"),
    videos: z.array(gameVideoDTOSchema).describe("Videos du jeu"),
    rating: z.number().nullable().describe("Note IGDB (0-100)"),
    ratingCount: z.number().int().nullable().describe("Nombre d'avis"),
    hypes: z.number().int().nullable().describe("Nombre d'anticipations IGDB"),
    developer: z.string().nullable().describe("Studio de developpement"),
    publisher: z.string().nullable().describe("Editeur"),
    genres: z.array(taxonRefSchema).describe("Genres du jeu"),
    themes: z.array(taxonRefSchema).describe("Themes du jeu"),
    gameModes: z.array(taxonRefSchema).describe("Modes de jeu"),
    playerPerspectives: z.array(taxonRefSchema).describe("Perspectives de jeu"),
    platforms: z.array(platformRefSchema).describe("Plateformes du jeu"),
    websites: z.array(gameWebsiteDTOSchema).describe("Sites web officiels/communautaires"),
    similarGames: z
      .array(similarGameDTOSchema)
      .describe("Jeux similaires, reclasses par similarite de contenu"),
  })
  .describe("Detail riche d'un jeu (fiche jeu)");
export type GameDetailDTO = z.infer<typeof gameDetailDTOSchema>;

// Resultat de recherche par nom (ajout manuel cote front). releaseYear seul suffit
// pour distinguer les re-editions (pas besoin de la date complete a ce stade).
// Forme de base : ce que le mapper pur ci-dessous produit, sans le flag "deja en
// collection" qui depend de l'utilisateur (calcule par le service, pas ici), et
// sans les plateformes locales (mappees par le service depuis platformIds, qui
// elles restent brutes/IGDB dans cette base -- c'est ce qui est cache en Redis).
// gameType/totalRatingCount/hypes/versionParent sont aussi bruts/IGDB : ils
// servent au service a filtrer les non-jeux (et les editions Deluxe/Ultimate/...)
// et reclasser par popularite avant de couper au top N, et ne figurent jamais
// dans le resultat final expose au front (cf. igdbSearchResultSchema). Usage
// interne uniquement (cache Redis) : jamais renvoye tel quel par une route.
export const igdbSearchResultBaseSchema = z
  .object({
    igdbId: z.number().int().describe("Identifiant IGDB du jeu"),
    name: z.string().describe("Nom du jeu"),
    coverUrl: z.string().nullable().describe("URL de la jaquette"),
    releaseYear: z.number().int().nullable().describe("Annee de sortie"),
    platformIds: z.array(z.number().int()).describe("Ids IGDB des plateformes (signal interne)"),
    gameType: z.number().int().nullable().describe("Type IGDB (signal interne de filtrage)"),
    totalRatingCount: z
      .number()
      .int()
      .nullable()
      .describe("Nombre d'avis (signal interne de classement)"),
    hypes: z.number().int().nullable().describe("Anticipations (signal interne de classement)"),
    versionParent: z
      .number()
      .int()
      .nullable()
      .describe("Id du jeu de base si edition (signal interne de filtrage)"),
  })
  .describe("Candidat brut de recherche IGDB, avant filtrage/classement (usage interne)");
export type IgdbSearchResultBase = z.infer<typeof igdbSearchResultBaseSchema>;

// Plateforme locale sur laquelle le jeu existe (mappee depuis platformIds via
// la table platforms.igdbId cote service). Le front n'affiche que celles-la
// dans le selecteur d'ajout a la collection.
export const localPlatformRefSchema = z
  .object({
    // Identifiant local (uuid en base) laisse en string : inutile d'imposer le
    // format uuid a la SERIALISATION d'une reponse (le durcir ne protege rien en
    // sortie et ferait echouer la reponse sur une valeur pourtant legitime).
    id: z.string().describe("Identifiant local de la plateforme"),
    name: z.string().describe("Nom de la plateforme"),
  })
  .describe("Plateforme locale sur laquelle le jeu existe");
export type LocalPlatformRef = z.infer<typeof localPlatformRefSchema>;

// Resultat final expose par la route : la base + le flag "deja en collection"
// (croise avec user_games cote service) + les plateformes locales mappees
// (cf. igdb.discovery.service.ts). gameType/totalRatingCount/hypes/versionParent
// ne sont que des signaux de filtrage/classement internes au service, jamais
// exposes ici (omis explicitement depuis la base).
export const igdbSearchResultSchema = igdbSearchResultBaseSchema
  .omit({
    platformIds: true,
    gameType: true,
    totalRatingCount: true,
    hypes: true,
    versionParent: true,
  })
  .extend({
    alreadyInCollection: z
      .boolean()
      .describe("Jeu deja present dans la collection de l'utilisateur"),
    platforms: z
      .array(localPlatformRefSchema)
      .describe("Plateformes locales sur lesquelles le jeu existe"),
  })
  .describe("Resultat de recherche IGDB par nom (ajout manuel)");
export type IgdbSearchResult = z.infer<typeof igdbSearchResultSchema>;

export function toSearchResultDTO(g: IgdbSearchGame): IgdbSearchResultBase {
  return {
    igdbId: g.igdbId,
    name: g.name,
    coverUrl: g.coverImageId ? igdbImageUrl(g.coverImageId, "t_cover_big") : null,
    releaseYear:
      g.firstReleaseDate != null ? new Date(g.firstReleaseDate * 1000).getUTCFullYear() : null,
    platformIds: g.platformIds,
    gameType: g.gameType,
    totalRatingCount: g.totalRatingCount,
    hypes: g.hypes,
    versionParent: g.versionParent,
  };
}

export function toUpcomingGameDTO(g: IgdbUpcomingGame): UpcomingGameDTO {
  return {
    igdbId: g.igdbId,
    title: g.name,
    releaseDate: g.releaseDate,
    coverUrl: g.coverImageId ? igdbImageUrl(g.coverImageId, "t_cover_big") : null,
    hypes: g.hypes,
    genres: g.genres,
    platforms: g.platforms,
  };
}

// Re-classe les similarGames par similarité de contenu au jeu cible.
// Utilise enrichedDetails comme source de verité : peut inclure jeux similaires IGDB
// + jeux du même studio (fusion faite en amont par le service).
// Si les détails sont disponibles, utilise rankBySimilarity. Sinon, garde l'ordre IGDB.
// Limite toujours le résultat à 12 jeux pour maintenir une performance acceptable
// et une UX sans surcharge d'options.
function rerankSimilarGames(
  target: IgdbGameDetail,
  similarGames: typeof target.similarGames,
  enrichedDetails: Map<number, IgdbGame>,
): typeof target.similarGames {
  const MAX_SIMILAR_GAMES = 12;

  // Si pas de détails enrichis, garder l'ordre IGDB brut (capé à 12).
  if (enrichedDetails.size === 0) return similarGames.slice(0, MAX_SIMILAR_GAMES);

  // Construire des GameForSimilarity pour le target et les candidats.
  const targetForRanking: GameForSimilarity = {
    gameId: String(target.igdbId),
    genreIds: target.genres.map((g) => String(g.igdbId)),
    themeIds: target.themes.map((t) => String(t.igdbId)),
    developer: target.developer,
    publisher: target.publisher,
    igdbRating: target.rating,
  };

  // Construire une liste parallèle de candidats rangés avec leurs données brutes.
  // enrichedDetails peut contenir :
  // 1. Les détails des similarGames IGDB (chargés par fetchGamesByIds)
  // 2. Les détails des jeux du même studio (chargés par fetchGamesByDeveloper)
  // On traite TOUS les candidats de enrichedDetails (pas seulement similarGames).
  const candidatesWithOriginal: Array<{ game: GameForSimilarity; original: IgdbSimilarGame }> = [];
  for (const [, details] of enrichedDetails) {
    // Exclure le jeu courant lui-même.
    if (details.igdbId === target.igdbId) continue;

    candidatesWithOriginal.push({
      game: {
        gameId: String(details.igdbId),
        genreIds: details.genres.map((g) => String(g.igdbId)),
        themeIds: details.themes.map((t) => String(t.igdbId)),
        developer: details.developer,
        publisher: details.publisher,
        igdbRating: details.rating,
      },
      original: {
        igdbId: details.igdbId,
        name: details.name,
        coverImageId: details.coverImageId,
      },
    });
  }

  // Pas de candidats avec détails : garder l'ordre brut (capé à 12).
  if (candidatesWithOriginal.length === 0) return similarGames.slice(0, MAX_SIMILAR_GAMES);

  // Re-ranger les candidats par similarité.
  const ranked = rankBySimilarity(
    targetForRanking,
    candidatesWithOriginal.map((c) => c.game),
  );

  // Mapper l'ordre rangé vers les données brutes et capper à 12.
  const rankedGameIds = new Set(ranked.map((g) => g.gameId));
  return candidatesWithOriginal
    .filter((c) => rankedGameIds.has(c.game.gameId))
    .sort((a, b) => {
      const indexA = ranked.findIndex((g) => g.gameId === a.game.gameId);
      const indexB = ranked.findIndex((g) => g.gameId === b.game.gameId);
      return indexA - indexB;
    })
    .map((c) => c.original)
    .slice(0, MAX_SIMILAR_GAMES);
}

// `today` (YYYY-MM-DD) injecte par l'appelant pour rester deterministe/testable.
// `enrichedSimilarGameDetails` optionnel : map des détails des similarGames pour re-ranking.
export function toGameDetailDTO(
  g: IgdbGameDetail,
  today: string,
  enrichedSimilarGameDetails?: Map<number, IgdbGame>,
): GameDetailDTO {
  const releaseStatus =
    g.releaseDate && g.releaseDate > today ? "upcoming" : "released";

  // Re-ranger les similarGames si les détails enrichis sont disponibles.
  const similarGames = enrichedSimilarGameDetails
    ? rerankSimilarGames(g, g.similarGames, enrichedSimilarGameDetails)
    : g.similarGames;

  return {
    igdbId: g.igdbId,
    title: g.name,
    summary: g.summary,
    storyline: g.storyline,
    releaseDate: g.releaseDate,
    releaseStatus,
    coverUrl: g.coverImageId ? igdbImageUrl(g.coverImageId, "t_cover_big") : null,
    artworkUrl: g.artworkImageId ? igdbImageUrl(g.artworkImageId, "t_1080p") : null,
    screenshots: g.screenshotImageIds.map((id) =>
      igdbImageUrl(id, "t_screenshot_big"),
    ),
    videos: g.videos,
    rating: g.rating,
    ratingCount: g.ratingCount,
    hypes: g.hypes,
    developer: g.developer,
    publisher: g.publisher,
    genres: g.genres,
    themes: g.themes,
    gameModes: g.gameModes,
    playerPerspectives: g.playerPerspectives,
    platforms: g.platforms,
    websites: g.websites,
    similarGames: similarGames.map((s) => ({
      igdbId: s.igdbId,
      title: s.name,
      coverUrl: s.coverImageId ? igdbImageUrl(s.coverImageId, "t_cover_big") : null,
    })),
  };
}

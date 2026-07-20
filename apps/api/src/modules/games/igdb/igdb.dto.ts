// DTOs publics renvoyes par les routes de decouverte IGDB (feed "a venir" + detail).
// Construits a partir des shapes domaine du client (IgdbUpcomingGame / IgdbGameDetail) :
// le client normalise la reponse IGDB brute, ces mappers ajoutent la presentation
// (construction des URLs d'images, statut de sortie).
import {
  igdbImageUrl,
  type IgdbUpcomingGame,
  type IgdbGameDetail,
  type IgdbGame,
  type IgdbSimilarGame,
  type IgdbSearchGame,
} from "./igdb.client.js";
import { rankBySimilarity, type GameForSimilarity } from "../../recommendations/similarity.js";

export type TaxonRef = { igdbId: number; name: string; slug: string };
export type PlatformRef = {
  igdbId: number;
  name: string;
  abbreviation: string | null;
};

export type UpcomingGameDTO = {
  igdbId: number;
  title: string;
  releaseDate: string | null; // YYYY-MM-DD
  coverUrl: string | null;
  hypes: number | null;
  genres: TaxonRef[];
  platforms: PlatformRef[];
};

export type GameVideoDTO = { name: string | null; youtubeId: string };
export type GameWebsiteDTO = { category: number; url: string };
export type SimilarGameDTO = {
  igdbId: number;
  title: string;
  coverUrl: string | null;
};

export type GameDetailDTO = {
  igdbId: number;
  title: string;
  summary: string | null;
  storyline: string | null;
  releaseDate: string | null; // YYYY-MM-DD
  releaseStatus: "upcoming" | "released";
  coverUrl: string | null;
  artworkUrl: string | null;
  screenshots: string[];
  videos: GameVideoDTO[];
  rating: number | null;
  ratingCount: number | null;
  hypes: number | null;
  developer: string | null;
  publisher: string | null;
  genres: TaxonRef[];
  themes: TaxonRef[];
  gameModes: TaxonRef[];
  playerPerspectives: TaxonRef[];
  platforms: PlatformRef[];
  websites: GameWebsiteDTO[];
  similarGames: SimilarGameDTO[];
};

// Resultat de recherche par nom (ajout manuel cote front). releaseYear seul suffit
// pour distinguer les re-editions (pas besoin de la date complete a ce stade).
// Forme de base : ce que le mapper pur ci-dessous produit, sans le flag "deja en
// collection" qui depend de l'utilisateur (calcule par le service, pas ici), et
// sans les plateformes locales (mappees par le service depuis platformIds, qui
// elles restent brutes/IGDB dans cette base -- c'est ce qui est cache en Redis).
// gameType/totalRatingCount/hypes sont aussi bruts/IGDB : ils servent au service
// a filtrer les non-jeux et reclasser par popularite avant de couper au top N,
// et ne figurent jamais dans le resultat final expose au front (cf. IgdbSearchResult).
export type IgdbSearchResultBase = {
  igdbId: number;
  name: string;
  coverUrl: string | null;
  releaseYear: number | null;
  platformIds: number[];
  gameType: number | null;
  totalRatingCount: number | null;
  hypes: number | null;
};

// Plateforme locale sur laquelle le jeu existe (mappee depuis platformIds via
// la table platforms.igdbId cote service). Le front n'affiche que celles-la
// dans le selecteur d'ajout a la collection.
export type LocalPlatformRef = { id: string; name: string };

// Resultat final expose par la route : la base + le flag "deja en collection"
// (croise avec user_games cote service) + les plateformes locales mappees
// (cf. igdb.discovery.service.ts). gameType/totalRatingCount/hypes ne sont que
// des signaux de filtrage/classement internes au service, jamais exposes ici.
export type IgdbSearchResult = Omit<
  IgdbSearchResultBase,
  "platformIds" | "gameType" | "totalRatingCount" | "hypes"
> & {
  alreadyInCollection: boolean;
  platforms: LocalPlatformRef[];
};

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

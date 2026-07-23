import { describe, it, expect, vi } from "vitest";
import { getGameDetail, type DiscoveryDeps } from "../igdb.discovery.service.js";
import type { IgdbGameDetail, IgdbGame } from "../igdb.client.js";

function fakeCache() {
  const store = new Map<string, string>();
  return {
    store,
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    set: vi.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
  };
}

const FIXED_NOW = new Date("2026-06-22T00:00:00Z");

// Jeu principal : Baldur's Gate 3, RPG / Fantasy Studio Larian
const baldursGate3: IgdbGameDetail = {
  igdbId: 1000,
  name: "Baldur's Gate 3",
  summary: "Epic CRPG",
  storyline: null,
  releaseDate: "2023-08-03",
  releaseDatePrecision: "day",
  rating: 95,
  ratingCount: 2000,
  hypes: 500,
  coverImageId: "bg3-cover",
  artworkImageId: "bg3-art",
  screenshotImageIds: [],
  videos: [],
  developer: "Larian Studios",
  publisher: "Larian Studios",
  genres: [
    { igdbId: 12, name: "RPG", slug: "rpg" },
    { igdbId: 5, name: "Adventure", slug: "adventure" },
  ],
  themes: [
    { igdbId: 1, name: "Fantasy", slug: "fantasy" },
  ],
  gameModes: [],
  playerPerspectives: [],
  platforms: [],
  websites: [],
  // 3 similarGames BRUTS : ORDONNÉS PAR IGDB (hypes/rating) =
  // Doom (FPS, hors-genre mais populaire), Baldur's Gate, Divinity OS 2.
  // APRÈS RE-RANKING par similarité : Divinity (même studio+genres) devrait
  // passer avant les autres malgré une hype/note IGDB moindre.
  similarGames: [
    // 1. Doom (FPS, hors-genre, MAIS populaire -> en haut de la liste IGDB)
    { igdbId: 2003, name: "Doom", coverImageId: "doom-cover" },
    // 2. Baldur's Gate (mêmes genres RPG/Adventure/Fantasy)
    { igdbId: 2002, name: "Baldur's Gate", coverImageId: "bg-cover" },
    // 3. Divinity: Original Sin 2 (même studio Larian, mêmes genres RPG/Fantasy)
    { igdbId: 2001, name: "Divinity: Original Sin 2", coverImageId: "dos2-cover" },
  ],
};

// Détails des similarGames pour enrichissement et re-ranking.
// La vraie API IGDB n'enrichit pas similar_games.genres, donc il faut
// fetcher les détails séparément. On simule cela ici.

const divinity: IgdbGame = {
  igdbId: 2001,
  name: "Divinity: Original Sin 2",
  summary: "CRPG like BG3",
  releaseDate: "2017-09-21",
  releaseDatePrecision: "day",
  rating: 93,
  ratingCount: 1500,
  coverImageId: "dos2-cover",
  artworkImageId: null,
  developer: "Larian Studios",
  publisher: "Larian Studios",
  genres: [
    { igdbId: 12, name: "RPG", slug: "rpg" },
    { igdbId: 5, name: "Adventure", slug: "adventure" },
  ],
  themes: [
    { igdbId: 1, name: "Fantasy", slug: "fantasy" },
  ],
  similarIgdbIds: [],
  hypes: 50,
  platformIds: [],
  gameType: null,
  versionParentIgdbId: null,
};

const baldursGateClassic: IgdbGame = {
  igdbId: 2002,
  name: "Baldur's Gate",
  summary: "Classic CRPG",
  releaseDate: "1998-11-30",
  releaseDatePrecision: "day",
  rating: 90,
  ratingCount: 800,
  coverImageId: "bg-cover",
  artworkImageId: null,
  developer: "BioWare",
  publisher: "Black Isle Studios",
  genres: [
    { igdbId: 12, name: "RPG", slug: "rpg" },
    { igdbId: 5, name: "Adventure", slug: "adventure" },
  ],
  themes: [
    { igdbId: 1, name: "Fantasy", slug: "fantasy" },
  ],
  similarIgdbIds: [],
  hypes: 20,
  platformIds: [],
  gameType: null,
  versionParentIgdbId: null,
};

const doom: IgdbGame = {
  igdbId: 2003,
  name: "Doom",
  summary: "FPS classic",
  releaseDate: "1993-12-10",
  releaseDatePrecision: "day",
  rating: 89,
  ratingCount: 500,
  coverImageId: "doom-cover",
  artworkImageId: null,
  developer: "id Software",
  publisher: "GT Interactive",
  genres: [
    { igdbId: 5, name: "Shooter", slug: "shooter" },
  ],
  themes: [],
  similarIgdbIds: [],
  hypes: 10,
  platformIds: [],
  gameType: null,
  versionParentIgdbId: null,
};

describe("Similaires de fiche re-classés par similarité de contenu", () => {
  it("classe le même studio / même genre avant le hors-genre", async () => {
    const cache = fakeCache();

    // Mock fetchGameDetail pour retourner le jeu principal.
    // Mock fetchGamesByIds (appelé par la logique de re-ranking) pour enrichir
    // les similarGames avec leurs genres/thèmes.

    const fetchGameDetail = vi.fn(async (igdbId: number) => {
      if (igdbId === baldursGate3.igdbId) {
        return baldursGate3;
      }
      return null;
    });

    const fetchGamesByIds = vi.fn(async (ids: number[]) => {
      // Simule le fetching des détails des similarGames pour re-ranking.
      const games: Record<number, IgdbGame> = {
        2001: divinity,
        2002: baldursGateClassic,
        2003: doom,
      };
      return ids.map((id) => games[id]).filter((g) => g);
    });

    const deps = {
      getToken: vi.fn(async () => "TOKEN"),
      fetchGameDetail,
      fetchGamesByIds,
      fetchGamesByDeveloper: vi.fn(async () => []),
      cache,
      now: () => FIXED_NOW,
    } as unknown as DiscoveryDeps;

    const detail = await getGameDetail(baldursGate3.igdbId, "CID", deps);

    expect(detail).not.toBeNull();
    if (!detail) return;

    // Sans scoring, l'ordre serait Divinity OS 2, Baldur's Gate, Doom (ordre IGDB).
    // Avec scoring :
    // - Divinity OS 2 : même studio (Larian) + genres communs (RPG, Fantasy) -> score maximal
    // - Baldur's Gate : genres communs (RPG, Adventure, Fantasy) mais pas même studio -> score moyen
    // - Doom : FPS, aucun genre/thème en commun -> score minimal
    // Attendu après re-ranking : Divinity OS 2 devrait être 1er, Doom devrait descendre.

    // Verifications :
    expect(detail.similarGames).toHaveLength(3);
    // Top 1 devrait être Divinity (même studio + genres)
    expect(detail.similarGames[0]?.title).toBe("Divinity: Original Sin 2");
    // Top 2 devrait être Baldur's Gate (genres seulement)
    expect(detail.similarGames[1]?.title).toBe("Baldur's Gate");
    // Top 3 devrait être Doom (hors-genre)
    expect(detail.similarGames[2]?.title).toBe("Doom");
  });

  it("limite les similarGames à 12 après re-ranking", async () => {
    // Crée une liste de 20 jeux similaires (dépassant le cap de 12).
    // Vérifie que le détail renvoyé ne contient que les 12 premiers après re-ranking.

    const bg3WithManySimilar: IgdbGameDetail = {
      ...baldursGate3,
      similarGames: Array.from({ length: 20 }, (_, i) => ({
        igdbId: 3000 + i,
        name: `Similar Game ${i + 1}`,
        coverImageId: `cover-${i}`,
      })),
    };

    // Enrichir avec les détails de tous les 20 jeux pour re-ranking.
    const enrichedGames: Record<number, IgdbGame> = {};
    for (let i = 0; i < 20; i++) {
      enrichedGames[3000 + i] = {
        igdbId: 3000 + i,
        name: `Similar Game ${i + 1}`,
        summary: null,
        releaseDate: "2020-01-01",
        releaseDatePrecision: "day",
        rating: 80 - i, // Décroissant pour avoir une variation de score
        ratingCount: 100,
        coverImageId: `cover-${i}`,
        artworkImageId: null,
        developer: i % 2 === 0 ? "Larian Studios" : "Other Studio", // Quelques avec même studio
        publisher: "Some Publisher",
        genres: [
          { igdbId: 12, name: "RPG", slug: "rpg" }, // Genres partagés avec le jeu cible
          { igdbId: 5, name: "Adventure", slug: "adventure" },
        ],
        themes: [
          { igdbId: 1, name: "Fantasy", slug: "fantasy" },
        ],
        similarIgdbIds: [],
        hypes: 100 - i,
      };
    }

    const cache = fakeCache();

    const fetchGameDetail = vi.fn(async (igdbId: number) => {
      if (igdbId === bg3WithManySimilar.igdbId) {
        return bg3WithManySimilar;
      }
      return null;
    });

    const fetchGamesByIds = vi.fn(async (ids: number[]) => {
      return ids.map((id) => enrichedGames[id]).filter((g) => g);
    });

    const deps = {
      getToken: vi.fn(async () => "TOKEN"),
      fetchGameDetail,
      fetchGamesByIds,
      fetchGamesByDeveloper: vi.fn(async () => []),
      cache,
      now: () => FIXED_NOW,
    } as unknown as DiscoveryDeps;

    const detail = await getGameDetail(bg3WithManySimilar.igdbId, "CID", deps);

    expect(detail).not.toBeNull();
    if (!detail) return;

    // Vérifications du cap à 12 :
    // - La liste de similarGames doit contenir EXACTEMENT 12 jeux
    expect(detail.similarGames).toHaveLength(12);

    // - Les 12 jeux retournés doivent être les 12 premiers après re-ranking
    // (classés par similarité, pas forcément par ordre IGDB d'origine).
    // On vérifie qu'ils sont dans l'intervalle [3000, 3019] et uniques.
    const returnedIds = detail.similarGames.map((g) => g.igdbId);
    expect(returnedIds).toHaveLength(12);
    expect(new Set(returnedIds).size).toBe(12); // Pas de doublons
    expect(returnedIds.every((id) => id >= 3000 && id <= 3019)).toBe(true); // Tous dans la plage
  });
});

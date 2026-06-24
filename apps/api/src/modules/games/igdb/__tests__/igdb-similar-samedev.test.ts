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

// Baldur's Gate 3 : dev Larian Studios, genres RPG/Fantasy
const baldursGate3: IgdbGameDetail = {
  igdbId: 1000,
  name: "Baldur's Gate 3",
  summary: "Epic CRPG",
  storyline: null,
  releaseDate: "2023-08-03",
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
  // Similaires IGDB bruts (ne contiennent PAS Divinity OS 2, absent du graphe IGDB de BG3)
  similarGames: [
    { igdbId: 2002, name: "Baldur's Gate", coverImageId: "bg-cover" },
    { igdbId: 2003, name: "Planescape: Torment", coverImageId: "pst-cover" },
  ],
};

// Divinity: Original Sin 2 (même studio que BG3, genres similaires)
// Cet jeu DOIT apparaître dans les similarGames après enrichissement par studio
const divinity: IgdbGame = {
  igdbId: 2001,
  name: "Divinity: Original Sin 2",
  summary: "CRPG like BG3",
  releaseDate: "2017-09-21",
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
};

// Baldur's Fate (Larian Studios, mais jeu de course, pas de genre/theme commun avec BG3)
// Ce jeu NE DOIT PAS apparaître dans les similarGames (filtre plancher genre/theme)
const baldursFate: IgdbGame = {
  igdbId: 2004,
  name: "Baldur's Fate",
  summary: "Racing game",
  releaseDate: "2020-05-15",
  rating: 70,
  ratingCount: 500,
  coverImageId: "bf-cover",
  artworkImageId: null,
  developer: "Larian Studios",
  publisher: "Larian Studios",
  genres: [
    { igdbId: 9, name: "Racing", slug: "racing" },
  ],
  themes: [],
  similarIgdbIds: [],
  hypes: 10,
};

// Détails des jeux de similarGames IGDB pour enrichissement
const baldursGateClassic: IgdbGame = {
  igdbId: 2002,
  name: "Baldur's Gate",
  summary: "Classic CRPG",
  releaseDate: "1998-11-30",
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
};

const planescarpeOne: IgdbGame = {
  igdbId: 2003,
  name: "Planescape: Torment",
  summary: "Classic CRPG",
  releaseDate: "1999-12-30",
  rating: 92,
  ratingCount: 600,
  coverImageId: "pst-cover",
  artworkImageId: null,
  developer: "Black Isle Studios",
  publisher: "Black Isle Studios",
  genres: [
    { igdbId: 12, name: "RPG", slug: "rpg" },
    { igdbId: 5, name: "Adventure", slug: "adventure" },
  ],
  themes: [
    { igdbId: 1, name: "Fantasy", slug: "fantasy" },
  ],
  similarIgdbIds: [],
  hypes: 15,
};

// Divinity: Original Sin 2 - Definitive Edition (re-edition du meme jeu de base)
const divinityDefinitiveEdition: IgdbGame = {
  igdbId: 2005,
  name: "Divinity: Original Sin 2 - Definitive Edition",
  summary: "Enhanced version of Original Sin 2",
  releaseDate: "2018-08-31",
  rating: 94,
  ratingCount: 1600,
  coverImageId: "dos2-de-cover",
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
  hypes: 60,
};

// Divinity II: The Dragon Knight Saga (re-edition)
const divinity2DKSaga: IgdbGame = {
  igdbId: 2006,
  name: "Divinity II: The Dragon Knight Saga",
  summary: "Enhanced version of Divinity II",
  releaseDate: "2010-10-19",
  rating: 80,
  ratingCount: 500,
  coverImageId: "div2-dks-cover",
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
  hypes: 5,
};

describe("Similaires de fiche enrichis par les jeux du meme studio", () => {
  it("ajoute les jeux du meme studio qui ne sont pas dans la liste IGDB", async () => {
    const cache = fakeCache();

    // Mock fetchGameDetail pour retourner le jeu principal
    const fetchGameDetail = vi.fn(async (igdbId: number) => {
      if (igdbId === baldursGate3.igdbId) {
        return baldursGate3;
      }
      return null;
    });

    // Mock fetchGamesByIds appelé par getGameDetail pour charger les détails
    // des similarGames IGDB (Baldur's Gate classic + Planescape)
    const fetchGamesByIds = vi.fn(async (ids: number[]) => {
      const games: Record<number, IgdbGame> = {
        2001: divinity,
        2002: baldursGateClassic,
        2003: planescarpeOne,
      };
      return ids.map((id) => games[id]).filter((g) => g);
    });

    // Mock fetchGamesByDeveloper pour retourner les jeux Larian
    const fetchGamesByDeveloper = vi.fn(async (developerName: string) => {
      if (developerName === "Larian Studios") {
        return [divinity];
      }
      return [];
    });

    const deps = {
      getToken: vi.fn(async () => "TOKEN"),
      fetchGameDetail,
      fetchGamesByIds,
      fetchGamesByDeveloper,
      cache,
      now: () => FIXED_NOW,
    } as unknown as DiscoveryDeps;

    const detail = await getGameDetail(baldursGate3.igdbId, "CID", deps);

    expect(detail).not.toBeNull();
    if (!detail) return;

    // Verifications :
    // 1. Divinity: Original Sin 2 DOIT maintenant apparaître dans similarGames
    const similarGameIds = detail.similarGames.map((g) => g.igdbId);
    expect(similarGameIds).toContain(2001);

    // 2. Divinity DOIT être classé en tête (même studio + mêmes genres = score maximal)
    // Score contentSimilarity pour Divinity:
    //   - Genres communs (RPG, Adventure) avec BG3 : Jaccard = 2/2 = 1.0
    //   - Thèmes communs (Fantasy) avec BG3 : Jaccard = 1/1 = 1.0
    //   - Même studio (Larian) : 1.0
    //   Score = 0.45*1.0 + 0.30*1.0 + 0.20*1.0 = 0.95
    //
    // Score pour Baldur's Gate classic:
    //   - Genres communs (RPG, Adventure) avec BG3 : Jaccard = 2/2 = 1.0
    //   - Thèmes communs (Fantasy) : Jaccard = 1/1 = 1.0
    //   - Pas même studio : 0
    //   Score = 0.45*1.0 + 0.30*1.0 + 0 = 0.75
    //
    // Score pour Planescape:
    //   - Genres communs (RPG, Adventure) : Jaccard = 2/2 = 1.0
    //   - Thèmes communs (Fantasy) : Jaccard = 1/1 = 1.0
    //   - Pas même studio : 0
    //   Score = 0.45*1.0 + 0.30*1.0 + 0 = 0.75 (même que BG classic)
    //   Départage par rating : Planescape (92) > BG (90)
    //
    // Ordre attendu : Divinity (0.95), Planescape (0.75, rating 92), Baldur's Gate (0.75, rating 90)

    expect(detail.similarGames[0]?.title).toBe("Divinity: Original Sin 2");
    expect(detail.similarGames[1]?.title).toBe("Planescape: Torment");
    expect(detail.similarGames[2]?.title).toBe("Baldur's Gate");
  });

  it("filtre les jeux du meme studio sans genre/theme commun avec le jeu courant", async () => {
    const cache = fakeCache();

    const fetchGameDetail = vi.fn(async (igdbId: number) => {
      if (igdbId === baldursGate3.igdbId) {
        return baldursGate3;
      }
      return null;
    });

    const fetchGamesByIds = vi.fn(async (ids: number[]) => {
      const games: Record<number, IgdbGame> = {
        2002: baldursGateClassic,
        2003: planescarpeOne,
      };
      return ids.map((id) => games[id]).filter((g) => g);
    });

    // Mock fetchGamesByDeveloper pour retourner Divinity (genre commun) ET Baldur's Fate (sans genre commun)
    const fetchGamesByDeveloper = vi.fn(async (developerName: string) => {
      if (developerName === "Larian Studios") {
        return [divinity, baldursFate];
      }
      return [];
    });

    const deps = {
      getToken: vi.fn(async () => "TOKEN"),
      fetchGameDetail,
      fetchGamesByIds,
      fetchGamesByDeveloper,
      cache,
      now: () => FIXED_NOW,
    } as unknown as DiscoveryDeps;

    const detail = await getGameDetail(baldursGate3.igdbId, "CID", deps);

    expect(detail).not.toBeNull();
    if (!detail) return;

    const similarGameIds = detail.similarGames.map((g) => g.igdbId);

    // Divinity DOIT être présent (même studio + genre RPG commun)
    expect(similarGameIds).toContain(2001);

    // Baldur's Fate NE DOIT PAS être présent (même studio mais ZÉRO genre/theme commun)
    expect(similarGameIds).not.toContain(2004);
  });

  it("plafonne la contribution meme-studio a 3 jeux et dedup les re-editions", async () => {
    const cache = fakeCache();

    const fetchGameDetail = vi.fn(async (igdbId: number) => {
      if (igdbId === baldursGate3.igdbId) {
        return baldursGate3;
      }
      return null;
    });

    const fetchGamesByIds = vi.fn(async (ids: number[]) => {
      const games: Record<number, IgdbGame> = {
        2002: baldursGateClassic,
        2003: planescarpeOne,
      };
      return ids.map((id) => games[id]).filter((g) => g);
    });

    // Mock fetchGamesByDeveloper pour retourner 6 jeux Larian (dont 2 re-editions du meme titre de base)
    const fetchGamesByDeveloper = vi.fn(async (developerName: string) => {
      if (developerName === "Larian Studios") {
        // Retourner 6 jeux : Divinity OS 2, Divinity OS 2 DE (re-edition), Divinity II DKS (re-edition),
        // et 3 autres pour tester le plafond
        return [divinity, divinityDefinitiveEdition, divinity2DKSaga, baldursFate];
      }
      return [];
    });

    const deps = {
      getToken: vi.fn(async () => "TOKEN"),
      fetchGameDetail,
      fetchGamesByIds,
      fetchGamesByDeveloper,
      cache,
      now: () => FIXED_NOW,
    } as unknown as DiscoveryDeps;

    const detail = await getGameDetail(baldursGate3.igdbId, "CID", deps);

    expect(detail).not.toBeNull();
    if (!detail) return;

    const similarGameIds = detail.similarGames.map((g) => g.igdbId);
    const similarGameTitles = detail.similarGames.map((g) => g.title);

    // Maximum 3 jeux du meme studio doivent etre presents
    const sameDeveloperIds = new Set([2001, 2005, 2006]); // Divinity OS 2, Divinity OS 2 DE, Divinity II DKS
    const sameDevInResult = similarGameIds.filter((id) => sameDeveloperIds.has(id));
    expect(sameDevInResult.length).toBeLessThanOrEqual(3);

    // Les deux re-editions du meme titre de base (Divinity OS 2 et Divinity OS 2 DE) ne doivent pas apparaitre ensemble
    // Seul le mieux note (Divinity OS 2 - Definitive Edition, rating 94) doit etre garde
    const hasDivinity = similarGameIds.includes(2001);
    const hasDefinitiveEdition = similarGameIds.includes(2005);
    if (hasDivinity && hasDefinitiveEdition) {
      // Les deux ne devraient PAS coexister
      expect.fail("Both Divinity: Original Sin 2 and its Definitive Edition should not coexist in results");
    }

    // Les autres genre-similaires (BG classic, Planescape) doivent etre presents
    expect(similarGameTitles).toContain("Baldur's Gate");
    expect(similarGameTitles).toContain("Planescape: Torment");

    // Baldur's Fate (meme studio mais sans genre commun) ne doit PAS etre present
    expect(similarGameIds).not.toContain(2004);
  });

  it("garde l'edition avec la meilleure similarite, pas seulement la mieux notee", async () => {
    // Cas du brief : deux re-editions du meme titre de base.
    // - Divinity: Original Sin 2 (base, rating 93) : genres+themes complets = meilleure similarite avec BG3
    // - Divinity: Original Sin 2 - Definitive Edition (rating 94, mieux notee) : genres+themes identiques
    //   mais en live IGDB, genre/theme manquants = similarite plus faible
    // Attendu : on garde la base (93) car meilleure similarite, pas la DE (94) meme si mieux notee.

    const cache = fakeCache();

    // Divinity OS 2 base : rating 93, genres/themes complets (2 genres, 1 theme)
    const divinityBase: IgdbGame = {
      igdbId: 3001,
      name: "Divinity: Original Sin 2",
      summary: "CRPG",
      releaseDate: "2017-09-21",
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
    };

    // Divinity OS 2 DE : rating 94 (mieux notee), mais genres/themes pauvres (genre RPG seulement, pas Adventure/Fantasy)
    // Cela simule le cas live IGDB ou la DE a une richesse genre/theme inferieure.
    const divinityDefinitiveEditionPoor: IgdbGame = {
      igdbId: 3002,
      name: "Divinity: Original Sin 2 - Definitive Edition",
      summary: "Enhanced version",
      releaseDate: "2018-08-31",
      rating: 94, // Mieux notee que la base
      ratingCount: 1600,
      coverImageId: "dos2-de-cover",
      artworkImageId: null,
      developer: "Larian Studios",
      publisher: "Larian Studios",
      genres: [
        { igdbId: 12, name: "RPG", slug: "rpg" },
        // Pas d'Adventure en live IGDB
      ],
      themes: [
        // Pas de Fantasy en live IGDB
      ],
      similarIgdbIds: [],
      hypes: 60,
    };

    const fetchGameDetail = vi.fn(async (igdbId: number) => {
      if (igdbId === baldursGate3.igdbId) {
        return baldursGate3;
      }
      return null;
    });

    const fetchGamesByIds = vi.fn(async (ids: number[]) => {
      // Aucun similarGame IGDB de BG3
      return [];
    });

    const fetchGamesByDeveloper = vi.fn(async (developerName: string) => {
      if (developerName === "Larian Studios") {
        // Retourner les deux editions du meme titre de base
        return [divinityBase, divinityDefinitiveEditionPoor];
      }
      return [];
    });

    const deps = {
      getToken: vi.fn(async () => "TOKEN"),
      fetchGameDetail,
      fetchGamesByIds,
      fetchGamesByDeveloper,
      cache,
      now: () => FIXED_NOW,
    } as unknown as DiscoveryDeps;

    const detail = await getGameDetail(baldursGate3.igdbId, "CID", deps);

    expect(detail).not.toBeNull();
    if (!detail) return;

    const similarGameIds = detail.similarGames.map((g) => g.igdbId);

    // Une SEULE edition du titre de base doit etre presente
    const divinityEditions = similarGameIds.filter((id) => id === 3001 || id === 3002);
    expect(divinityEditions.length).toBe(1);

    // C'est la base (3001, meilleure similarite) qui doit etre gardee, pas la DE (3002, mieux notee mais moins similaire)
    expect(similarGameIds).toContain(3001);
    expect(similarGameIds).not.toContain(3002);

    // Verifier que c'est bien la base qui apparait dans les resultats
    expect(detail.similarGames[0]?.title).toBe("Divinity: Original Sin 2");
  });
});

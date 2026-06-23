import { describe, it, expect } from "vitest";
import { contentSimilarity, rankBySimilarity, sharesGenreOrTheme, normalizeGameTitle, type GameForSimilarity } from "../similarity.js";

const bg3: GameForSimilarity = { gameId: "bg3", genreIds: ["rpg","turn"], themeIds: ["fantasy"], developer: "Larian Studios", publisher: "Larian Studios", igdbRating: 96 };
const divinity: GameForSimilarity = { gameId: "dos2", genreIds: ["rpg","turn"], themeIds: ["fantasy"], developer: "Larian Studios", publisher: "Larian Studios", igdbRating: 94 };
const pillars: GameForSimilarity = { gameId: "poe", genreIds: ["rpg"], themeIds: ["fantasy"], developer: "Obsidian", publisher: "Paradox", igdbRating: 88 };
const doom: GameForSimilarity = { gameId: "doom", genreIds: ["shooter"], themeIds: ["sci-fi"], developer: "id Software", publisher: "Bethesda", igdbRating: 89 };

describe("contentSimilarity", () => {
  it("même studio + mêmes genres score le plus haut", () => {
    expect(contentSimilarity(bg3, divinity)).toBeGreaterThan(contentSimilarity(bg3, pillars));
  });
  it("genres totalement différents score le plus bas", () => {
    expect(contentSimilarity(bg3, doom)).toBeLessThan(contentSimilarity(bg3, pillars));
  });
  it("le même studio est un bonus, pas un filtre : un autre studio même genre reste pertinent", () => {
    expect(contentSimilarity(bg3, pillars)).toBeGreaterThan(0.3);
  });
});

describe("rankBySimilarity", () => {
  it("classe Divinity avant Pillars avant Doom pour BG3", () => {
    const ranked = rankBySimilarity(bg3, [doom, pillars, divinity]).map((g) => g.gameId);
    expect(ranked).toEqual(["dos2", "poe", "doom"]);
  });
});

describe("sharesGenreOrTheme", () => {
  it("retourne true si les deux jeux partagent un genre", () => {
    expect(sharesGenreOrTheme(bg3, divinity)).toBe(true);
    expect(sharesGenreOrTheme(bg3, pillars)).toBe(true);
  });
  it("retourne true si les deux jeux partagent un theme", () => {
    expect(sharesGenreOrTheme(bg3, pillars)).toBe(true);
  });
  it("retourne false si aucun genre ni theme commun", () => {
    const racingGame: GameForSimilarity = {
      gameId: "racing",
      genreIds: ["racing"],
      themeIds: [],
      developer: null,
      publisher: null,
      igdbRating: null,
    };
    expect(sharesGenreOrTheme(bg3, racingGame)).toBe(false);
  });
  it("retourne false si l'un des deux a des genres/themes vides", () => {
    const noGenres: GameForSimilarity = {
      gameId: "empty",
      genreIds: [],
      themeIds: [],
      developer: null,
      publisher: null,
      igdbRating: null,
    };
    expect(sharesGenreOrTheme(bg3, noGenres)).toBe(false);
  });
});

describe("normalizeGameTitle", () => {
  it("retire les suffixes apres ' - ' (edition markers)", () => {
    expect(normalizeGameTitle("Divinity: Original Sin 2 - Definitive Edition")).toBe(
      "divinity: original sin 2"
    );
    expect(normalizeGameTitle("Baldur's Gate - Enhanced Edition")).toBe("baldur's gate");
  });

  it("normalise la casse en minuscule", () => {
    expect(normalizeGameTitle("DIVINITY: ORIGINAL SIN 2")).toBe("divinity: original sin 2");
  });

  it("trim les espaces", () => {
    expect(normalizeGameTitle("  Divinity: Original Sin 2  ")).toBe("divinity: original sin 2");
  });

  it("detecte correctement les re-editions du meme titre de base", () => {
    const base = "Divinity: Original Sin 2";
    const definitive = "Divinity: Original Sin 2 - Definitive Edition";
    const enhanced = "Divinity: Original Sin 2 - Enhanced Edition";

    const baseNorm = normalizeGameTitle(base);
    const defNorm = normalizeGameTitle(definitive);
    const enhNorm = normalizeGameTitle(enhanced);

    // Tous les trois doivent normaliser au meme titre de base
    expect(baseNorm).toBe(defNorm);
    expect(baseNorm).toBe(enhNorm);
  });

  it("distingue les differents titres de base", () => {
    const divinity2 = normalizeGameTitle("Divinity: Original Sin 2");
    const divinity3 = normalizeGameTitle("Divinity: Original Sin 3");
    expect(divinity2).not.toBe(divinity3);
  });
});

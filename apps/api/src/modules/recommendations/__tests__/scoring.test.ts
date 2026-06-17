import { describe, it, expect } from "vitest";
import { ratingQuality, hypeQuality, scoreCandidate, DISCOVERY_QUALITY_FLOOR } from "../scoring.js";

describe("ratingQuality", () => {
  it("peu de votes -> tire vers le prior bas (0.4), pas 0.5", () => {
    const q = ratingQuality(100, 0); // note max mais 0 vote
    expect(q).toBeCloseTo(0.4, 2);
  });
  it("beaucoup de votes -> proche de la note", () => {
    expect(ratingQuality(90, 1000)).toBeCloseTo(0.9, 2);
  });
  it("rating null -> prior bas", () => {
    expect(ratingQuality(null, 1000)).toBe(0.4);
  });
});

it("hypeQuality croit avec la hype et est borne a 1", () => {
  expect(hypeQuality(0)).toBe(0);
  expect(hypeQuality(100000)).toBeLessThanOrEqual(1);
});

it("un jeu de qualite inconnue ne bat pas une valeur sure a profil egal", () => {
  const prof = new Map([["g:rpg", 1]]);
  const sur = scoreCandidate(
    prof,
    { gameId: "a", genreIds: ["rpg"], tagIds: [], igdbRating: 93, igdbRatingCount: 1000, igdbHypes: null, similarVotes: 0 },
    "discovery",
    1,
  );
  const inconnu = scoreCandidate(
    prof,
    { gameId: "b", genreIds: ["rpg"], tagIds: [], igdbRating: 95, igdbRatingCount: 4, igdbHypes: null, similarVotes: 0 },
    "discovery",
    1,
  );
  expect(sur.score).toBeGreaterThan(inconnu.score);
});

it("DISCOVERY_QUALITY_FLOOR est bien accessible pour le filtering", () => {
  // Constante exportee pour filtrer les candidats discovery
  expect(DISCOVERY_QUALITY_FLOOR).toBe(0.35);
});

describe("quality floor logic", () => {
  it("un jeu avec rating bas et votes confirmes descend sous le plancher", () => {
    const lowRated = ratingQuality(25, 500); // 25/100 avec confiance =1
    expect(lowRated).toBeLessThan(DISCOVERY_QUALITY_FLOOR);
  });

  it("un jeu avec rating moyen et votes confirmes reste au-dessus du plancher", () => {
    const midRated = ratingQuality(50, 500); // 50/100 avec confiance = 1
    expect(midRated).toBeGreaterThanOrEqual(DISCOVERY_QUALITY_FLOOR);
  });

  it("un jeu de qualite inconnue (prior 0.4) reste au-dessus du plancher", () => {
    const unknown = ratingQuality(null, 1000);
    expect(unknown).toBeGreaterThanOrEqual(DISCOVERY_QUALITY_FLOOR);
  });
});

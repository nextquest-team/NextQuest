import { describe, it, expect } from "vitest";
import { ratingQuality, hypeQuality, scoreCandidate } from "../scoring.js";

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

describe("cosine match (non-saturation)", () => {
  it("un jeu partageant 3 genres dominants score plus haut qu'un partageant 1 seul", () => {
    // Profil : genres rpg (0.4), action (0.3), aventure (0.2) — total 0.9 (normalise)
    const prof = new Map([
      ["g:rpg", 0.4],
      ["g:action", 0.3],
      ["g:aventure", 0.2],
    ]);

    // Candidat A : partage les 3 genres dominants
    const candA = scoreCandidate(
      prof,
      {
        gameId: "a",
        genreIds: ["rpg", "action", "aventure"],
        tagIds: [],
        igdbRating: 50,
        igdbRatingCount: 100,
        igdbHypes: null,
        similarVotes: 0,
        platformIds: [],
        gameType: null,
        versionParentIgdbId: null,
      },
      "library_unplayed",
      1,
    );

    // Candidat B : partage seulement le genre minoritaire
    const candB = scoreCandidate(
      prof,
      {
        gameId: "b",
        genreIds: ["aventure"],
        tagIds: [],
        igdbRating: 50,
        igdbRatingCount: 100,
        igdbHypes: null,
        similarVotes: 0,
        platformIds: [],
        gameType: null,
        versionParentIgdbId: null,
      },
      "library_unplayed",
      1,
    );

    // Verification non-saturation : matchG de A ne sature pas a 1, et A > B
    expect(candA.factors.matchG).toBeGreaterThan(candB.factors.matchG);
    expect(candA.factors.matchG).toBeLessThan(1.0);
    expect(candA.score).toBeGreaterThan(candB.score);
  });
});

it("un jeu de qualite inconnue ne bat pas une valeur sure a profil egal", () => {
  const prof = new Map([["g:rpg", 1]]);
  const sur = scoreCandidate(
    prof,
    { gameId: "a", genreIds: ["rpg"], tagIds: [], igdbRating: 93, igdbRatingCount: 1000, igdbHypes: null, similarVotes: 0, platformIds: [], gameType: null, versionParentIgdbId: null },
    "discovery",
    1,
  );
  const inconnu = scoreCandidate(
    prof,
    { gameId: "b", genreIds: ["rpg"], tagIds: [], igdbRating: 95, igdbRatingCount: 4, igdbHypes: null, similarVotes: 0, platformIds: [], gameType: null, versionParentIgdbId: null },
    "discovery",
    1,
  );
  expect(sur.score).toBeGreaterThan(inconnu.score);
});

describe("quality-gated similarity scoring", () => {
  it("deux candidats avec similarite identique ranke different selon la qualite", () => {
    // Profil simple : 1 genre rpg
    const prof = new Map([["g:rpg", 1]]);

    // Candidat A : haute qualite (0.85), similarite 0.80
    const candA = scoreCandidate(
      prof,
      {
        gameId: "a",
        genreIds: ["rpg"],
        tagIds: [],
        igdbRating: 85,
        igdbRatingCount: 1000,
        igdbHypes: null,
        similarVotes: 80,
        platformIds: [],
        gameType: null,
        versionParentIgdbId: null,
      },
      "discovery",
      100,
    );

    // Candidat B : basse qualite (0.40), similarite 0.80
    const candB = scoreCandidate(
      prof,
      {
        gameId: "b",
        genreIds: ["rpg"],
        tagIds: [],
        igdbRating: 40,
        igdbRatingCount: 100,
        igdbHypes: null,
        similarVotes: 80,
        platformIds: [],
        gameType: null,
        versionParentIgdbId: null,
      },
      "discovery",
      100,
    );

    // La contribution de similarite de A est 0.80 * 0.85 = 0.68,
    // celle de B est 0.80 * 0.40 = 0.32. A deve scorer plus haut.
    expect(candA.score).toBeGreaterThan(candB.score);
  });

  it("un jeu mediocre-mais-similaire rank sous un jeu haute-qualite moins similaire", () => {
    const prof = new Map([["g:rpg", 1]]);

    // Candidat A : basse qualite (0.40), genre match parfait, similarite haute 0.80
    const candA = scoreCandidate(
      prof,
      {
        gameId: "a",
        genreIds: ["rpg"],
        tagIds: [],
        igdbRating: 40,
        igdbRatingCount: 100,
        igdbHypes: null,
        similarVotes: 80,
        platformIds: [],
        gameType: null,
        versionParentIgdbId: null,
      },
      "discovery",
      100,
    );

    // Candidat B : haute qualite (0.84), genre match moins bon, similarite basse 0.20
    const candB = scoreCandidate(
      prof,
      {
        gameId: "b",
        genreIds: ["rpg"],
        tagIds: [],
        igdbRating: 84,
        igdbRatingCount: 500,
        igdbHypes: null,
        similarVotes: 20,
        platformIds: [],
        gameType: null,
        versionParentIgdbId: null,
      },
      "discovery",
      100,
    );

    // Meme avec similarity plus haute, la basse qualite de A ne le sauve pas :
    // A's sim contribution = 0.80 * 0.40 = 0.32
    // B's sim contribution = 0.20 * 0.84 = 0.168, mais la qualite brute de B (0.84 vs 0.40) domine.
    expect(candB.score).toBeGreaterThan(candA.score);
  });
});

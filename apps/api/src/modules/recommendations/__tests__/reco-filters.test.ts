import { describe, it, expect } from "vitest";
import { filterCandidates } from "../reco-filters.js";
import type { Candidate } from "../scoring.js";

const base = {
  genreIds: [],
  tagIds: [],
  igdbRating: 80,
  igdbRatingCount: 100,
  igdbHypes: null,
  similarVotes: 0,
};

describe("filterCandidates", () => {
  it("exclut un candidat dont aucune plateforme n'est possedee", () => {
    const c: Candidate = { ...base, gameId: "a", platformIds: ["ps5"], gameType: 0, versionParentIgdbId: null };
    expect(filterCandidates([c], new Set(["pc"]))).toHaveLength(0);
  });

  it("garde un candidat sans plateforme connue (fail-open)", () => {
    const c: Candidate = { ...base, gameId: "b", platformIds: [], gameType: 0, versionParentIgdbId: null };
    expect(filterCandidates([c], new Set(["pc"]))).toHaveLength(1);
  });

  it("exclut DLC/expansion liee/bundle/pack et editions", () => {
    const mk = (gameType: number, versionParentIgdbId: number | null): Candidate => ({
      ...base,
      gameId: "x",
      platformIds: ["pc"],
      gameType,
      versionParentIgdbId,
    });
    for (const gt of [1, 2, 3, 13]) {
      expect(filterCandidates([mk(gt, null)], new Set(["pc"]))).toHaveLength(0);
    }
    expect(filterCandidates([mk(0, 999)], new Set(["pc"]))).toHaveLength(0); // edition
    expect(filterCandidates([mk(4, null)], new Set(["pc"]))).toHaveLength(1); // standalone gardee
  });
});

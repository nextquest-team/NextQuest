import { describe, it, expect } from "vitest";
import { diversify } from "../diversify.js";

describe("diversify", () => {
  it("ne garde pas plus de maxPerGenre du même genre dominant en tête", () => {
    const items = [
      { gameId: "a", score: 0.9, dominantGenreId: "rpg" },
      { gameId: "b", score: 0.85, dominantGenreId: "rpg" },
      { gameId: "c", score: 0.8, dominantGenreId: "rpg" },
      { gameId: "d", score: 0.7, dominantGenreId: "fps" },
    ];
    const out = diversify(items, 2).map((i) => i.gameId);
    // les 2 premiers rpg passent, le 3e rpg est repoussé après le fps
    expect(out.slice(0, 3)).toEqual(["a", "b", "d"]);
    expect(out[3]).toBe("c");
  });
  it("genre dominant null n'est jamais plafonné", () => {
    const items = [
      { gameId: "a", score: 0.9, dominantGenreId: null },
      { gameId: "b", score: 0.8, dominantGenreId: null },
      { gameId: "c", score: 0.7, dominantGenreId: null },
    ];
    expect(diversify(items, 1).map((i) => i.gameId)).toEqual(["a", "b", "c"]);
  });
});

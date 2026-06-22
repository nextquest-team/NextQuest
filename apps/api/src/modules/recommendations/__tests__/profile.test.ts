import { describe, it, expect } from "vitest";
import {
  engagement,
  affinity,
  buildBaseProfile,
  applySwipeDeltas,
  normalize,
} from "../profile.js";

describe("engagement", () => {
  it("ratio vs duree normale quand time_to_beat fiable", () => {
    // 30h jouees, jeu de 25h, count fiable -> ratio 1.2
    expect(engagement(1800, 1500, 40)).toBeCloseTo(1.2, 2);
  });
  it("clamp a 1.5 (no-life)", () => {
    expect(engagement(100000, 1500, 40)).toBe(1.5);
  });
  it("fallback log quand pas de ref fiable (count < 10)", () => {
    const e = engagement(1800, 1500, 3);
    expect(e).toBeGreaterThan(0);
    expect(e).toBeLessThanOrEqual(1.5);
  });
});

describe("affinity", () => {
  const base = {
    gameId: "x",
    playtimeMinutes: 1500,
    rating: null,
    normallyMinutes: 1500,
    ttbCount: 40,
    genreIds: [],
    tagIds: [],
  };
  it("completed pese plus que backlog", () => {
    const c = affinity({ ...base, status: "completed" });
    const b = affinity({ ...base, status: "backlog" });
    expect(c).toBeGreaterThan(b);
  });
  it("abandoned est negatif", () => {
    expect(affinity({ ...base, status: "abandoned" })).toBeLessThan(0);
  });
});

describe("buildBaseProfile + normalize", () => {
  it("pondere par IDF et normalise le top a 1", () => {
    const owned = [
      {
        gameId: "1",
        status: "completed",
        playtimeMinutes: 1500,
        rating: null,
        normallyMinutes: 1500,
        ttbCount: 40,
        genreIds: ["rpg"],
        tagIds: [],
      },
    ];
    const idf = new Map([
      ["g:rpg", 2],
    ]);
    const prof = normalize(buildBaseProfile(owned, idf));
    expect(prof.get("g:rpg")).toBe(1);
  });
});

describe("applySwipeDeltas", () => {
  it("dismissed baisse le poids, added le monte fort", () => {
    const base = new Map([["g:horror", 1]]);
    const down = applySwipeDeltas(base, [
      { feedback: "dismissed", genreIds: ["horror"], tagIds: [] },
    ]);
    const up = applySwipeDeltas(base, [
      { feedback: "added", genreIds: ["horror"], tagIds: [] },
    ]);
    expect(down.get("g:horror")!).toBeLessThan(1);
    expect(up.get("g:horror")!).toBeGreaterThan(1);
  });
});

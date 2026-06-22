import { it, expect } from "vitest";
import { idf, buildIdfMap } from "../idf.js";

it("un genre ubiquitaire a un IDF plus faible qu'un genre rare", () => {
  const commun = idf(1000, 800);
  const rare = idf(1000, 5);
  expect(rare).toBeGreaterThan(commun);
});

it("buildIdfMap mappe chaque dimension", () => {
  const m = buildIdfMap(1000, [
    { dimension: "g:rpg", freq: 5 },
    { dimension: "g:action", freq: 800 },
  ]);
  expect(m.get("g:rpg")!).toBeGreaterThan(m.get("g:action")!);
});

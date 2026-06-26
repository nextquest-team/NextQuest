import { describe, it, expect } from "vitest";
import { buildReason } from "../recommendations.dto.js";

const f = (o: Partial<{matchG:number;matchT:number;quality:number;sim:number}>) =>
  ({ matchG: 0, matchT: 0, quality: 0, sim: 0, ...o });

describe("buildReason", () => {
  it("a tous les accents français", () => {
    const text = buildReason("discovery", f({ matchG: 0.5, quality: 0.8, sim: 0.5 }), []);
    expect(text).toContain("préférés");
    expect(text).toContain("très bien noté");
    expect(text).not.toMatch(/preferes|tres bien note/);
  });
  it("cite les genres matchés au lieu de 'préférés'", () => {
    const text = buildReason("discovery", f({ matchG: 0.5 }), ["RPG"]);
    expect(text).toContain("parce que tu aimes");
    expect(text).toContain("RPG");
  });
  it("cite les genres matchés quand fournis", () => {
    const text = buildReason("discovery", f({ matchG: 0.5 }), ["RPG", "Infiltration"]);
    expect(text).toContain("RPG");
  });
  it("library_unplayed mentionne la biblio avec accents", () => {
    const text = buildReason("library_unplayed", f({ matchG: 0.4 }), []);
    expect(text).toContain("jamais lancé");
  });
  it("fallback si aucun facteur", () => {
    expect(buildReason("discovery", f({}), [])).toBe("suggestion basée sur tes goûts");
  });
});

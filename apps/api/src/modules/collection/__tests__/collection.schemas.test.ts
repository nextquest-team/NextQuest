import { describe, it, expect } from "vitest";
import { updateGameStatusSchema } from "../collection.schemas.js";

describe("updateGameStatusSchema", () => {
  it("accepte les 4 statuts MVP", () => {
    for (const status of ["backlog", "playing", "completed", "abandoned"]) {
      expect(updateGameStatusSchema.parse({ status })).toEqual({ status });
    }
  });

  it("rejette wishlist (hors MVP, flux ajout manuel)", () => {
    expect(() => updateGameStatusSchema.parse({ status: "wishlist" })).toThrow();
  });

  it("rejette une valeur inconnue", () => {
    expect(() => updateGameStatusSchema.parse({ status: "foo" })).toThrow();
  });
});

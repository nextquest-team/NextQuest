import { describe, it, expect } from "vitest";
import {
  updateGameStatusSchema,
  listCollectionQuerySchema,
  updateUserGameSchema,
  addGameSchema,
} from "../collection.schemas.js";

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

describe("listCollectionQuerySchema", () => {
  it("applique les défauts limit=20 offset=0 includeHidden=false", () => {
    const r = listCollectionQuerySchema.parse({});
    expect(r).toEqual({ limit: 20, offset: 0, includeHidden: false });
  });
  it("coerce limit/offset depuis des strings d'URL", () => {
    const r = listCollectionQuerySchema.parse({ limit: "50", offset: "10" });
    expect(r.limit).toBe(50);
    expect(r.offset).toBe(10);
  });
  it("parse includeHidden='true' en booléen (pas de coerce piégeux)", () => {
    expect(
      listCollectionQuerySchema.parse({ includeHidden: "true" }).includeHidden,
    ).toBe(true);
    expect(
      listCollectionQuerySchema.parse({ includeHidden: "false" }).includeHidden,
    ).toBe(false);
  });
  it("rejette limit > 100", () => {
    expect(() => listCollectionQuerySchema.parse({ limit: "101" })).toThrow();
  });
  it("rejette un status hors MVP", () => {
    expect(() =>
      listCollectionQuerySchema.parse({ status: "wishlist" }),
    ).toThrow();
  });
  it("accepte un terme de recherche et le trim", () => {
    expect(
      listCollectionQuerySchema.parse({ search: "  Hollow  " }).search,
    ).toBe("Hollow");
  });
  it("rejette une recherche vide ou uniquement faite d'espaces", () => {
    expect(() => listCollectionQuerySchema.parse({ search: "   " })).toThrow();
  });
  it("rejette une recherche de plus de 100 caracteres", () => {
    expect(() =>
      listCollectionQuerySchema.parse({ search: "a".repeat(101) }),
    ).toThrow();
  });
});

describe("updateUserGameSchema", () => {
  it("accepte un sous-ensemble de champs", () => {
    expect(updateUserGameSchema.parse({ rating: 8 }).rating).toBe(8);
  });
  it("accepte null pour effacer note/avis", () => {
    expect(updateUserGameSchema.parse({ rating: null, review: null })).toEqual({
      rating: null,
      review: null,
    });
  });
  it("rejette un body vide", () => {
    expect(() => updateUserGameSchema.parse({})).toThrow();
  });
  it("rejette une note hors 1..10", () => {
    expect(() => updateUserGameSchema.parse({ rating: 0 })).toThrow();
    expect(() => updateUserGameSchema.parse({ rating: 11 })).toThrow();
  });
});

describe("addGameSchema", () => {
  it("exige un gameId uuid", () => {
    expect(() => addGameSchema.parse({ gameId: "nope" })).toThrow();
  });
  it("accepte gameId seul (platformId optionnel)", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(addGameSchema.parse({ gameId: id })).toEqual({ gameId: id });
  });
});

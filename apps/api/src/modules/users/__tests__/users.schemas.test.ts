import { describe, it, expect } from "vitest";
import { updateProfileSchema } from "../users.schemas.js";

describe("updateProfileSchema", () => {
  it("accepte un payload minimal valide (un seul champ)", () => {
    const result = updateProfileSchema.safeParse({ displayName: "Jean-Bap" });
    expect(result.success).toBe(true);
  });

  it("accepte tous les champs ensemble", () => {
    const result = updateProfileSchema.safeParse({
      displayName: "Jean-Bap",
      avatarUrl: "https://example.com/a.png",
      bio: "Bio",
      locale: "fr",
      visibility: "public",
    });
    expect(result.success).toBe(true);
  });

  it("rejette un body vide", () => {
    const result = updateProfileSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejette displayName vide", () => {
    const result = updateProfileSchema.safeParse({ displayName: "" });
    expect(result.success).toBe(false);
  });

  it("rejette displayName de plus de 50 caracteres", () => {
    const result = updateProfileSchema.safeParse({ displayName: "a".repeat(51) });
    expect(result.success).toBe(false);
  });

  it("rejette avatarUrl non-URL", () => {
    const result = updateProfileSchema.safeParse({ avatarUrl: "pas une url" });
    expect(result.success).toBe(false);
  });

  it("rejette avatarUrl de plus de 2048 caracteres", () => {
    const longUrl = "https://example.com/" + "a".repeat(2050);
    const result = updateProfileSchema.safeParse({ avatarUrl: longUrl });
    expect(result.success).toBe(false);
  });

  it("accepte bio vide (reset)", () => {
    const result = updateProfileSchema.safeParse({ bio: "" });
    expect(result.success).toBe(true);
  });

  it("rejette bio de plus de 500 caracteres", () => {
    const result = updateProfileSchema.safeParse({ bio: "a".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("rejette locale inconnue", () => {
    const result = updateProfileSchema.safeParse({ locale: "es" });
    expect(result.success).toBe(false);
  });

  it("rejette visibility inconnue", () => {
    const result = updateProfileSchema.safeParse({ visibility: "everyone" });
    expect(result.success).toBe(false);
  });

  it("accepte les trois valeurs de visibility", () => {
    expect(updateProfileSchema.safeParse({ visibility: "private" }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ visibility: "friends_only" }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ visibility: "public" }).success).toBe(true);
  });
});

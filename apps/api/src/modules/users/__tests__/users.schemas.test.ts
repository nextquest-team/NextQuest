import { describe, it, expect } from "vitest";
import { updateProfileSchema, FAVORITE_PLATFORMS } from "../users.schemas.js";

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

describe("updateProfileSchema — champs profil etendus", () => {
  it("accepte un code pays ISO alpha-2 et null pour effacer", () => {
    expect(updateProfileSchema.safeParse({ country: "FR" }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ country: null }).success).toBe(true);
  });

  it("rejette les codes pays invalides", () => {
    for (const bad of ["fr", "FRA", "F1", ""]) {
      expect(updateProfileSchema.safeParse({ country: bad }).success).toBe(false);
    }
  });

  it("accepte une date de naissance plausible", () => {
    expect(updateProfileSchema.safeParse({ birthdate: "1990-05-12" }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ birthdate: null }).success).toBe(true);
  });

  it("rejette les dates de naissance invalides ou hors plage", () => {
    for (const bad of ["2050-01-01", "1850-01-01", "12/05/1990", "1990-5-1"]) {
      expect(updateProfileSchema.safeParse({ birthdate: bad }).success).toBe(false);
    }
  });

  it("n'accepte que les plateformes de la whitelist", () => {
    for (const p of FAVORITE_PLATFORMS) {
      expect(updateProfileSchema.safeParse({ favoritePlatform: p }).success).toBe(true);
    }
    expect(updateProfileSchema.safeParse({ favoritePlatform: "steam" }).success).toBe(false);
  });

  it("valide les liens sociaux : https uniquement, cles whitelistees", () => {
    expect(
      updateProfileSchema.safeParse({ socialLinks: { twitch: "https://twitch.tv/jb" } }).success,
    ).toBe(true);
    expect(
      updateProfileSchema.safeParse({ socialLinks: { twitch: "http://twitch.tv/jb" } }).success,
    ).toBe(false);
    expect(
      updateProfileSchema.safeParse({ socialLinks: { myspace: "https://myspace.com/jb" } }).success,
    ).toBe(false);
    expect(updateProfileSchema.safeParse({ socialLinks: null }).success).toBe(true);
  });

  it("refuse toujours un body vide", () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(false);
  });
});

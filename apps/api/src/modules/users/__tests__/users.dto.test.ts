import { describe, it, expect } from "vitest";
import { toUserDTO } from "../users.dto.js";

describe("toUserDTO", () => {
  const baseUser = {
    id: "uuid-1",
    email: "user@example.com",
    username: "user1",
    passwordHash: "argon2id$hash",
    displayName: "Jean-Bap",
    avatarUrl: "https://example.com/avatar.png",
    bio: "Joueur PC depuis 1998",
    locale: "fr",
    visibility: "public" as const,
    role: "user" as const,
    emailVerified: true,
    emailVerifiedAt: new Date("2026-04-01T10:00:00Z"),
    failedLoginAttempts: 0,
    lockedUntil: null,
    onboardingCompleted: false,
    deletedAt: null,
    createdAt: new Date("2026-04-01T10:00:00Z"),
    updatedAt: null,
    country: null,
    birthdate: null,
    favoritePlatform: null,
    socialLinks: null,
  };

  it("inclut les champs publics attendus", () => {
    const dto = toUserDTO(baseUser);
    expect(dto).toEqual({
      id: "uuid-1",
      email: "user@example.com",
      username: "user1",
      displayName: "Jean-Bap",
      avatarUrl: "https://example.com/avatar.png",
      bio: "Joueur PC depuis 1998",
      country: null,
      birthdate: null,
      favoritePlatform: null,
      socialLinks: null,
      locale: "fr",
      visibility: "public",
      emailVerified: true,
      onboardingCompleted: false,
      createdAt: "2026-04-01T10:00:00.000Z",
    });
  });

  it("n'expose JAMAIS les champs sensibles", () => {
    const dto = toUserDTO(baseUser) as Record<string, unknown>;
    expect(dto.passwordHash).toBeUndefined();
    expect(dto.failedLoginAttempts).toBeUndefined();
    expect(dto.lockedUntil).toBeUndefined();
    expect(dto.deletedAt).toBeUndefined();
    expect(dto.role).toBeUndefined();
    expect(dto.emailVerifiedAt).toBeUndefined();
  });

  it("preserve les nullables (displayName, avatarUrl, bio)", () => {
    const dto = toUserDTO({
      ...baseUser,
      displayName: null,
      avatarUrl: null,
      bio: null,
    });
    expect(dto.displayName).toBeNull();
    expect(dto.avatarUrl).toBeNull();
    expect(dto.bio).toBeNull();
  });

  it("serialise createdAt en ISO 8601", () => {
    const dto = toUserDTO(baseUser);
    expect(typeof dto.createdAt).toBe("string");
    expect(dto.createdAt).toBe("2026-04-01T10:00:00.000Z");
  });

  it("expose les champs profil etendus", () => {
    const dto = toUserDTO({
      ...baseUser,
      country: "FR",
      birthdate: "1990-05-12",
      favoritePlatform: "pc",
      socialLinks: { twitch: "https://twitch.tv/jb" },
    });
    expect(dto.country).toBe("FR");
    expect(dto.birthdate).toBe("1990-05-12");
    expect(dto.favoritePlatform).toBe("pc");
    expect(dto.socialLinks).toEqual({ twitch: "https://twitch.tv/jb" });
  });

  it("renvoie null pour les champs etendus absents", () => {
    const dto = toUserDTO({
      ...baseUser,
      country: null,
      birthdate: null,
      favoritePlatform: null,
      socialLinks: null,
    });
    expect(dto.country).toBeNull();
    expect(dto.birthdate).toBeNull();
    expect(dto.favoritePlatform).toBeNull();
    expect(dto.socialLinks).toBeNull();
  });
});

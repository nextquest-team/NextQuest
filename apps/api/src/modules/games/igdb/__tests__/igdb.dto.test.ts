import { describe, it, expect } from "vitest";
import { toGameDetailDTO, toUpcomingGameDTO } from "../igdb.dto.js";
import type { IgdbGameDetail, IgdbUpcomingGame } from "../igdb.client.js";

const detail: IgdbGameDetail = {
  igdbId: 1,
  name: "Sample",
  summary: "s",
  storyline: null,
  releaseDate: "2013-09-17",
  rating: 90,
  ratingCount: 100,
  hypes: 5,
  coverImageId: "cov",
  artworkImageId: "art",
  screenshotImageIds: ["ss1", "ss2"],
  videos: [{ name: "T", youtubeId: "yt" }],
  developer: "Dev",
  publisher: "Pub",
  genres: [{ igdbId: 12, name: "RPG", slug: "rpg" }],
  themes: [],
  gameModes: [],
  playerPerspectives: [],
  platforms: [{ igdbId: 6, name: "PC", abbreviation: "PC" }],
  websites: [{ category: 1, url: "https://x" }],
  similarGames: [{ igdbId: 11, name: "Sim", coverImageId: "sc" }],
};

describe("toGameDetailDTO", () => {
  it("marque 'upcoming' si releaseDate > today et construit les URLs d'images", () => {
    const dto = toGameDetailDTO({ ...detail, releaseDate: "2030-01-01" }, "2026-06-22");
    expect(dto.releaseStatus).toBe("upcoming");
    expect(dto.title).toBe("Sample");
    expect(dto.coverUrl).toBe(
      "https://images.igdb.com/igdb/image/upload/t_cover_big/cov.jpg",
    );
    expect(dto.artworkUrl).toBe(
      "https://images.igdb.com/igdb/image/upload/t_1080p/art.jpg",
    );
    expect(dto.screenshots).toEqual([
      "https://images.igdb.com/igdb/image/upload/t_screenshot_big/ss1.jpg",
      "https://images.igdb.com/igdb/image/upload/t_screenshot_big/ss2.jpg",
    ]);
    expect(dto.similarGames[0]).toEqual({
      igdbId: 11,
      title: "Sim",
      coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/sc.jpg",
    });
  });

  it("marque 'released' si releaseDate <= today", () => {
    expect(toGameDetailDTO(detail, "2026-06-22").releaseStatus).toBe("released");
  });

  it("images absentes -> URLs null", () => {
    const dto = toGameDetailDTO(
      { ...detail, coverImageId: null, artworkImageId: null, screenshotImageIds: [] },
      "2026-06-22",
    );
    expect(dto.coverUrl).toBeNull();
    expect(dto.artworkUrl).toBeNull();
    expect(dto.screenshots).toEqual([]);
  });
});

describe("toUpcomingGameDTO", () => {
  it("mappe titre, cover URL, genres et plateformes", () => {
    const g: IgdbUpcomingGame = {
      igdbId: 7,
      name: "Coming Soon",
      releaseDate: "2027-03-01",
      coverImageId: "cv",
      hypes: 42,
      genres: [{ igdbId: 12, name: "RPG", slug: "rpg" }],
      platforms: [{ igdbId: 48, name: "PS5", abbreviation: "PS5" }],
    };
    const dto = toUpcomingGameDTO(g);
    expect(dto).toEqual({
      igdbId: 7,
      title: "Coming Soon",
      releaseDate: "2027-03-01",
      coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/cv.jpg",
      hypes: 42,
      genres: [{ igdbId: 12, name: "RPG", slug: "rpg" }],
      platforms: [{ igdbId: 48, name: "PS5", abbreviation: "PS5" }],
    });
  });

  it("cover absente -> coverUrl null", () => {
    const dto = toUpcomingGameDTO({
      igdbId: 1,
      name: "X",
      releaseDate: null,
      coverImageId: null,
      hypes: null,
      genres: [],
      platforms: [],
    });
    expect(dto.coverUrl).toBeNull();
  });
});

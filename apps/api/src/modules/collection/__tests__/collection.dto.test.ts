import { describe, it, expect } from "vitest";
import {
  toCollectionItemDTO,
  toCollectionDetailDTO,
  type CollectionRow,
} from "../collection.dto.js";

const baseRow: CollectionRow = {
  userGameId: "ug1",
  status: "playing",
  playtimeMinutes: 120,
  rating: 8,
  review: "top",
  isHidden: false,
  startedAt: "2026-01-01",
  completedAt: null,
  addedAt: new Date("2026-01-01T10:00:00Z"),
  gameId: "g1",
  title: "Hollow Knight",
  slug: "hollow-knight-1",
  coverUrl: "c",
  backgroundUrl: "b",
  releaseDate: "2017-02-24",
  developer: "Team Cherry",
  publisher: "Team Cherry",
  igdbRating: 91.2,
  igdbId: 123,
};

describe("toCollectionItemDTO", () => {
  it("mappe la row + genres + tags et calcule isEnriched", () => {
    const dto = toCollectionItemDTO(
      baseRow,
      [{ id: "ge1", name: "Platform", slug: "platform" }],
      [{ id: "t1", name: "Action", slug: "action" }],
    );
    expect(dto.userGameId).toBe("ug1");
    expect(dto.game.isEnriched).toBe(true);
    // igdbId expose : permet au front d'appeler GET /games/igdb/:igdbId au clic.
    expect(dto.game.igdbId).toBe(123);
    expect(dto.addedAt).toBe("2026-01-01T10:00:00.000Z");
    expect(dto.genres).toHaveLength(1);
    expect(dto.tags[0].name).toBe("Action");
  });
  it("isEnriched=false quand igdbId est null", () => {
    const dto = toCollectionItemDTO({ ...baseRow, igdbId: null }, [], []);
    expect(dto.game.isEnriched).toBe(false);
    expect(dto.game.igdbId).toBeNull();
  });
});

describe("toCollectionDetailDTO", () => {
  it("ajoute description et similarGames", () => {
    const dto = toCollectionDetailDTO(
      { ...baseRow, description: "desc" },
      [],
      [],
      [{ id: "g2", title: "Ori", coverUrl: null }],
    );
    expect(dto.description).toBe("desc");
    expect(dto.similarGames[0].title).toBe("Ori");
  });
});

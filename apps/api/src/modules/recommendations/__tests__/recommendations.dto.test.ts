import { describe, it, expect } from "vitest";
import { toRecommendationDTO, type RecommendationRow } from "../recommendations.dto.js";

// Fixture complete d'une ligne brute telle que retournee par RECO_FIELDS (jointure
// recommendations + games). Tous les champs de RecommendationRow doivent y figurer.
const baseRow: RecommendationRow = {
  id: "reco-1",
  bucket: "discovery",
  score: "0.9",
  reason: { text: "suggestion basee sur tes gouts", factors: {} },
  gameId: "game-1",
  title: "Baldur's Gate 3",
  slug: "baldurs-gate-3",
  coverUrl: "https://example.com/cover.jpg",
  releaseDate: "2023-08-03",
  releaseStatus: "released",
  igdbRating: 96,
  igdbId: 52189,
};

describe("toRecommendationDTO", () => {
  it("expose igdbId pour lier vers la fiche catalogue (#110)", () => {
    const dto = toRecommendationDTO({ ...baseRow, igdbId: 52189 }, []);
    expect(dto.game.igdbId).toBe(52189);
  });

  it("expose igdbId a null pour un jeu custom sans correspondance IGDB", () => {
    const dto = toRecommendationDTO({ ...baseRow, igdbId: null }, []);
    expect(dto.game.igdbId).toBeNull();
  });
});

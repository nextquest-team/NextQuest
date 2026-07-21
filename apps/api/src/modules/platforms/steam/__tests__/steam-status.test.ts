import { describe, it, expect } from "vitest";
import { mapSteamStatus } from "../steam.service.js";

describe("mapSteamStatus", () => {
  it("du temps de jeu total (>0) => playing", () => {
    expect(mapSteamStatus(120)).toBe("playing");
  });
  it("aucun temps de jeu (0) => backlog", () => {
    expect(mapSteamStatus(0)).toBe("backlog");
  });
});

import { describe, it, expect } from "vitest";
import { mapSteamStatus } from "../steam.service.js";

describe("mapSteamStatus", () => {
  it("joué récemment (>0 min sur 2 semaines) => playing", () => {
    expect(mapSteamStatus(120)).toBe("playing");
  });
  it("pas joué récemment (0) => backlog", () => {
    expect(mapSteamStatus(0)).toBe("backlog");
  });
  it("jamais joué récemment, même avec du temps total => backlog (le total n'entre pas ici)", () => {
    expect(mapSteamStatus(0)).toBe("backlog");
  });
});

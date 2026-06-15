import { describe, it, expect, vi } from "vitest";
import { getTwitchToken, TWITCH_TOKEN_CACHE_KEY } from "../igdb.auth.js";

function fakeStore(initial: string | null) {
  const calls = { set: [] as unknown[][] };
  let value = initial;
  return {
    calls,
    get: vi.fn(async () => value),
    set: vi.fn(async (...args: unknown[]) => {
      calls.set.push(args);
      value = args[1] as string;
      return "OK";
    }),
  };
}

const okToken = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

describe("getTwitchToken", () => {
  it("renvoie le token en cache sans appeler Twitch", async () => {
    const store = fakeStore("cached-token");
    const fetchMock = vi.fn();

    const token = await getTwitchToken("id", "secret", store, fetchMock);

    expect(token).toBe("cached-token");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.get).toHaveBeenCalledWith(TWITCH_TOKEN_CACHE_KEY);
  });

  it("recupere et cache le token quand le cache est vide", async () => {
    const store = fakeStore(null);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okToken({ access_token: "fresh", expires_in: 5000000, token_type: "bearer" }));

    const token = await getTwitchToken("myid", "mysecret", store, fetchMock);

    expect(token).toBe("fresh");
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("id.twitch.tv/oauth2/token");
    expect(url).toContain("client_id=myid");
    expect(url).toContain("client_secret=mysecret");
    expect(url).toContain("grant_type=client_credentials");
    // Cache avec un TTL strictement inferieur a expires_in (marge de securite).
    const setArgs = store.calls.set[0];
    expect(setArgs[0]).toBe(TWITCH_TOKEN_CACHE_KEY);
    expect(setArgs[1]).toBe("fresh");
    expect(setArgs[2]).toBe("EX");
    expect(Number(setArgs[3])).toBeGreaterThan(0);
    expect(Number(setArgs[3])).toBeLessThan(5000000);
  });

  it("leve si Twitch repond un statut non-200", async () => {
    const store = fakeStore(null);
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });

    await expect(getTwitchToken("id", "secret", store, fetchMock)).rejects.toThrow(/403/);
  });
});

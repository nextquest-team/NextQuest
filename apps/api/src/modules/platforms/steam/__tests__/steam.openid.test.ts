import { describe, it, expect, vi } from "vitest";
import {
  buildSteamLoginUrl,
  extractSteamId,
  verifySteamAssertion,
} from "../steam.openid.js";

describe("extractSteamId", () => {
  it("extrait le SteamID64 d'un claimed_id valide", () => {
    expect(
      extractSteamId("https://steamcommunity.com/openid/id/76561198000000000"),
    ).toBe("76561198000000000");
  });

  it("renvoie null si le claimed_id ne vient pas du domaine Steam OpenID", () => {
    expect(extractSteamId("https://evil.com/openid/id/76561198000000000")).toBeNull();
    expect(extractSteamId("not-a-url")).toBeNull();
    expect(extractSteamId("https://steamcommunity.com/openid/id/abc")).toBeNull();
  });
});

describe("buildSteamLoginUrl", () => {
  it("construit l'URL OpenID Steam avec les bons parametres", () => {
    const url = new URL(
      buildSteamLoginUrl({
        realm: "http://localhost:3000",
        returnTo:
          "http://localhost:3000/api/platforms/steam/callback?state=abc",
      }),
    );

    expect(url.origin + url.pathname).toBe(
      "https://steamcommunity.com/openid/login",
    );
    expect(url.searchParams.get("openid.ns")).toBe(
      "http://specs.openid.net/auth/2.0",
    );
    expect(url.searchParams.get("openid.mode")).toBe("checkid_setup");
    expect(url.searchParams.get("openid.realm")).toBe("http://localhost:3000");
    expect(url.searchParams.get("openid.return_to")).toBe(
      "http://localhost:3000/api/platforms/steam/callback?state=abc",
    );
    expect(url.searchParams.get("openid.identity")).toBe(
      "http://specs.openid.net/auth/2.0/identifier_select",
    );
    expect(url.searchParams.get("openid.claimed_id")).toBe(
      "http://specs.openid.net/auth/2.0/identifier_select",
    );
  });
});

describe("verifySteamAssertion", () => {
  const validParams = {
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "id_res",
    "openid.claimed_id":
      "https://steamcommunity.com/openid/id/76561198000000000",
    "openid.signed": "signed,fields",
    "openid.sig": "somesig",
  };

  it("renvoie le SteamID quand Steam confirme l'assertion (is_valid:true)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      text: async () =>
        "ns:http://specs.openid.net/auth/2.0\nis_valid:true\n",
    });

    const steamId = await verifySteamAssertion(validParams, fetchMock);

    expect(steamId).toBe("76561198000000000");
    const [endpoint, init] = fetchMock.mock.calls[0];
    expect(endpoint).toBe("https://steamcommunity.com/openid/login");
    expect(init.method).toBe("POST");
    expect(String(init.body)).toContain("openid.mode=check_authentication");
  });

  it("renvoie null quand Steam invalide l'assertion (is_valid:false)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      text: async () =>
        "ns:http://specs.openid.net/auth/2.0\nis_valid:false\n",
    });

    expect(await verifySteamAssertion(validParams, fetchMock)).toBeNull();
  });
});

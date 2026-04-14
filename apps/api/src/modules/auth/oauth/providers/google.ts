import { getProviderConfig } from "../oauth.config.js";
import type { OAuthProvider, OAuthUserProfile } from "./types.js";

const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export const googleProvider: OAuthProvider = {
  async exchangeCode(code: string, redirectUri: string): Promise<string> {
    const config = getProviderConfig("google");
    if (!config) throw new Error("Google OAuth not configured");

    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Google token exchange failed: ${response.status} ${body}`);
    }

    const data = (await response.json()) as { access_token: string };
    return data.access_token;
  },

  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    const response = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Google userinfo failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      id: string;
      email: string;
      name?: string;
      picture?: string;
    };

    return {
      providerId: data.id,
      email: data.email,
      displayName: data.name ?? null,
      avatarUrl: data.picture ?? null,
    };
  },
};

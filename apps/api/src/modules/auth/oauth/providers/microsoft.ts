import { getProviderConfig } from "../oauth.config.js";
import type { OAuthProvider, OAuthUserProfile } from "./types.js";

const GRAPH_ME_URL = "https://graph.microsoft.com/v1.0/me";

export const microsoftProvider: OAuthProvider = {
  async exchangeCode(code: string, redirectUri: string): Promise<string> {
    const config = getProviderConfig("microsoft");
    if (!config) throw new Error("Microsoft OAuth not configured");

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
      throw new Error(`Microsoft token exchange failed: ${response.status} ${body}`);
    }

    const data = (await response.json()) as { access_token: string };
    return data.access_token;
  },

  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    const response = await fetch(GRAPH_ME_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Microsoft Graph /me failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      id: string;
      mail?: string;
      userPrincipalName: string;
      displayName?: string;
    };

    // Microsoft may return the email in either mail or userPrincipalName field
    const email = data.mail ?? data.userPrincipalName;

    return {
      providerId: data.id,
      email,
      displayName: data.displayName ?? null,
      avatarUrl: null, // Graph /me endpoint doesn't directly provide avatar
    };
  },
};

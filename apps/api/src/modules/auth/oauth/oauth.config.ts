interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
}

const providers: Record<string, ProviderConfig> = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["openid", "email", "profile"],
  },
  microsoft: {
    clientId: process.env.MICROSOFT_CLIENT_ID ?? "",
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
    authorizationUrl:
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: ["openid", "email", "profile", "User.Read"],
  },
};

export function getProviderConfig(provider: string): ProviderConfig | null {
  return providers[provider] ?? null;
}

export function getSupportedProviders(): string[] {
  return Object.keys(providers);
}

export function buildCallbackUrl(provider: string): string {
  const baseUrl = process.env.API_BASE_URL ?? "http://localhost:3000";
  return `${baseUrl}/api/auth/oauth/${provider}/callback`;
}

export function buildAuthorizationUrl(
  provider: string,
  state: string,
): string | null {
  const config = getProviderConfig(provider);
  if (!config) return null;

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: buildCallbackUrl(provider),
    response_type: "code",
    scope: config.scopes.join(" "),
    state,
    access_type: "offline",
    prompt: "consent",
  });

  return `${config.authorizationUrl}?${params.toString()}`;
}

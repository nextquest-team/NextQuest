interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
}

// Configs statiques (URLs, scopes) -- les credentials viennent de process.env a l'appel,
// pas au chargement du module, sinon dotenv n'a pas encore charge le .env
const providerConfigs: Record<string, Omit<ProviderConfig, "clientId" | "clientSecret"> & { clientIdEnv: string; clientSecretEnv: string }> = {
  google: {
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["openid", "email", "profile"],
  },
  microsoft: {
    clientIdEnv: "MICROSOFT_CLIENT_ID",
    clientSecretEnv: "MICROSOFT_CLIENT_SECRET",
    authorizationUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: ["openid", "email", "profile", "User.Read"],
  },
};

export function getProviderConfig(provider: string): ProviderConfig | null {
  const cfg = providerConfigs[provider];
  if (!cfg) return null;

  return {
    clientId: process.env[cfg.clientIdEnv] ?? "",
    clientSecret: process.env[cfg.clientSecretEnv] ?? "",
    authorizationUrl: cfg.authorizationUrl,
    tokenUrl: cfg.tokenUrl,
    scopes: cfg.scopes,
  };
}

export function getSupportedProviders(): string[] {
  return Object.keys(providerConfigs);
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
  });

  return `${config.authorizationUrl}?${params.toString()}`;
}

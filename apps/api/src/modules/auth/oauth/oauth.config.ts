interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  prompt?: string;
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
    // Force Google à afficher le sélecteur de compte à chaque connexion
    prompt: "select_account",
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
    prompt: cfg.prompt,
  };
}

export function getSupportedProviders(): string[] {
  return Object.keys(providerConfigs);
}

export function buildCallbackUrl(provider: string): string {
  // OAUTH_CALLBACK_BASE_URL doit etre l'URL publique de l'API (joignable par le
  // browser de l'utilisateur), parce que c'est elle qu'on envoie comme redirect_uri
  // a Google/Microsoft. API_BASE_URL est l'URL interne (utilisee pour les appels
  // service-to-service en Docker, ex: http://api:3000) -- elle ne peut pas etre
  // resolue par le browser. En l'absence d'override explicite, on retombe sur
  // API_BASE_URL puis localhost pour conserver le dev hors Docker sans config.
  const baseUrl =
    process.env.OAUTH_CALLBACK_BASE_URL ??
    process.env.API_BASE_URL ??
    "http://localhost:3000";
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
    ...(config.prompt ? { prompt: config.prompt } : {}),
  });

  return `${config.authorizationUrl}?${params.toString()}`;
}

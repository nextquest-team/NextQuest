export interface OAuthUserProfile {
  providerId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface OAuthProvider {
  exchangeCode(code: string, redirectUri: string): Promise<string>;
  getUserProfile(accessToken: string): Promise<OAuthUserProfile>;
}

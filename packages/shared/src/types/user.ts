export type Locale = "fr" | "en";

export type FavoritePlatform = "pc" | "playstation" | "xbox" | "nintendo" | "mobile";

export type SocialLinks = Partial<
  Record<"twitch" | "youtube" | "discord" | "twitter" | "instagram", string>
>;

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  country: string | null; // ISO 3166-1 alpha-2
  birthdate: string | null; // YYYY-MM-DD
  favoritePlatform: FavoritePlatform | null;
  socialLinks: SocialLinks | null;
  locale: Locale;
  visibility: "private" | "friends_only" | "public";
  emailVerified: boolean;
  onboardingCompleted: boolean;
  createdAt: string; // ISO 8601
}

export type GameStatus = "wishlist" | "backlog" | "playing" | "completed" | "abandoned";

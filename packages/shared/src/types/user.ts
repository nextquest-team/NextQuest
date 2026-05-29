export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  locale: string;
  visibility: "private" | "friends_only" | "public";
  emailVerified: boolean;
  onboardingCompleted: boolean;
  createdAt: string; // ISO 8601
}

export type GameStatus = "wishlist" | "backlog" | "playing" | "completed" | "abandoned";

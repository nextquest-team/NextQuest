export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  locale: "fr" | "en";
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

export type GameStatus = "wishlist" | "backlog" | "playing" | "completed" | "abandoned";

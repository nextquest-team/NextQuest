// Validation Zod des inputs auth -- premiere ligne de defense avant toute logique metier
import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30),
  password: z.string().min(8).max(128),
  displayName: z.string().max(50).optional(),
  locale: z.enum(["fr", "en"]).default("fr"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Le refreshToken est optionnel dans le body car il peut venir du cookie httpOnly
export const refreshSchema = z.object({
  refreshToken: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

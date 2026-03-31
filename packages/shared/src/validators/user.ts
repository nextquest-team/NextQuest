import { z } from "zod";

export const CreateUserSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30),
  displayName: z.string().max(50).optional(),
  locale: z.enum(["fr", "en"]).default("fr"),
});

export type CreateUser = z.infer<typeof CreateUserSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type Login = z.infer<typeof LoginSchema>;

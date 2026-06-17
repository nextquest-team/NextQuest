import { z } from "zod";

export const RECO_BUCKETS = [
  "library_unplayed",
  "discovery",
  "upcoming",
] as const;

export const listRecoQuerySchema = z.object({
  bucket: z.enum(RECO_BUCKETS).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListRecoQuery = z.infer<typeof listRecoQuerySchema>;

export const recoParamsSchema = z.object({ id: z.string().uuid() });

export const feedbackBodySchema = z.object({
  action: z.enum(["liked", "dismissed", "added"]),
});

export type FeedbackBody = z.infer<typeof feedbackBodySchema>;

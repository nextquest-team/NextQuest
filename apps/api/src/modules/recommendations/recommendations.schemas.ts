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

// Refresh : ids des recos actuellement affichees que l'user veut passer.
// Tableau vide tolere (refresh "a blanc" = simple relecture du set courant).
// Borne a 20 pour eviter un payload abusif (le front en affiche 3 max).
export const refreshBodySchema = z.object({
  skip: z.array(z.string().uuid()).max(20).default([]),
});

export type RefreshBody = z.infer<typeof refreshBodySchema>;

// Refresh renvoie un set groupe (comme GET /recommendations sans bucket) : seul
// limit est pertinent (nb de recos par bucket), pas de pagination par offset.
export const refreshQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

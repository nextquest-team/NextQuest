import { db, games } from "@nextquest/db";
import { and, or, eq, ilike, count } from "drizzle-orm";
import type { GameSummaryDTO } from "./games.dto.js";

// Recherche dans le catalogue par titre. Renvoie les jeux publics + les jeux
// custom du user lui-meme (prives par defaut, visibles par leur createur).
export async function searchGames(params: {
  userId: string;
  search: string;
  limit: number;
  offset: number;
}): Promise<{ items: GameSummaryDTO[]; total: number }> {
  const { userId, search, limit, offset } = params;
  const visible = or(eq(games.visibility, "public"), eq(games.createdBy, userId));
  const where = and(ilike(games.title, `%${search}%`), visible);

  const [{ total }] = await db.select({ total: count() }).from(games).where(where);
  if (total === 0) return { items: [], total: 0 };

  const rows = await db
    .select({
      id: games.id,
      title: games.title,
      slug: games.slug,
      coverUrl: games.coverUrl,
      releaseDate: games.releaseDate,
      igdbId: games.igdbId,
    })
    .from(games)
    .where(where)
    .orderBy(games.title)
    .limit(limit)
    .offset(offset);

  const items = rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    coverUrl: r.coverUrl,
    releaseDate: r.releaseDate,
    isEnriched: r.igdbId !== null,
  }));
  return { items, total };
}

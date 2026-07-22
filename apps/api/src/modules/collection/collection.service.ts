import {
  db,
  userGames,
  userGameStatusHistory,
  games,
  genres,
  tags,
  gameGenres,
  gameTags,
  gameSimilar,
  platforms,
} from "@nextquest/db";
import {
  and,
  eq,
  sql,
  inArray,
  desc,
  count,
  isNull,
  isNotNull,
  ilike,
} from "drizzle-orm";
import {
  igdbImageUrl,
  fetchGamesByIds,
  type IgdbGame,
} from "../games/igdb/igdb.client.js";
import { getTwitchToken } from "../games/igdb/igdb.auth.js";
import { enrichGames } from "../games/igdb/igdb.service.js";
import { redis } from "../../lib/redis.js";
import type {
  GameStatus,
  UpdateUserGameInput,
  AddGameInput,
  AddIgdbGameInput,
} from "./collection.schemas.js";
import {
  toUserGameStatusDTO,
  toCollectionItemDTO,
  toCollectionDetailDTO,
  type UserGameStatusDTO,
  type CollectionItemDTO,
  type CollectionDetailDTO,
  type GenreRef,
  type TagRef,
  type SimilarGameRef,
  type CollectionRow,
} from "./collection.dto.js";

// Champs de statut selectionnes / retournes, factorises pour rester coherents
// entre la lecture, le RETURNING et le DTO.
const STATUS_FIELDS = {
  id: userGames.id,
  status: userGames.status,
  startedAt: userGames.startedAt,
  completedAt: userGames.completedAt,
  updatedAt: userGames.updatedAt,
} as const;

// Change le statut d'un jeu de la collection de l'user.
// Renvoie null si le user_game n'existe pas ou n'appartient pas a l'user
// (la route en deduit un 404, sans distinguer les deux cas).
export async function updateGameStatus(
  userId: string,
  userGameId: string,
  newStatus: GameStatus,
): Promise<UserGameStatusDTO | null> {
  const [current] = await db
    .select(STATUS_FIELDS)
    .from(userGames)
    .where(and(eq(userGames.id, userGameId), eq(userGames.userId, userId)))
    .limit(1);

  if (!current) return null;

  // No-op : meme statut -> aucune ecriture, aucune ligne d'historique.
  if (current.status === newStatus) {
    return toUserGameStatusDTO(current);
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(userGames)
      .set({
        status: newStatus,
        updatedAt: new Date(),
        // started_at / completed_at : poses a la 1re transition seulement,
        // jamais reecrits ni vides ensuite (trace honnete pour les stats).
        ...(newStatus === "playing" && current.startedAt === null
          ? { startedAt: sql`current_date` }
          : {}),
        ...(newStatus === "completed" && current.completedAt === null
          ? { completedAt: sql`current_date` }
          : {}),
      })
      .where(eq(userGames.id, userGameId))
      .returning(STATUS_FIELDS);

    await tx.insert(userGameStatusHistory).values({
      userGameId,
      oldStatus: current.status,
      newStatus,
    });

    return toUserGameStatusDTO(updated);
  });
}

// Champs item factorises, partages entre la lecture liste, le detail et le
// rechargement apres mutation. Coherent avec le type CollectionRow du DTO.
const ITEM_FIELDS = {
  userGameId: userGames.id,
  status: userGames.status,
  playtimeMinutes: userGames.playtimeMinutes,
  rating: userGames.rating,
  review: userGames.review,
  isHidden: userGames.isHidden,
  startedAt: userGames.startedAt,
  completedAt: userGames.completedAt,
  addedAt: userGames.createdAt,
  gameId: games.id,
  title: games.title,
  slug: games.slug,
  coverUrl: games.coverUrl,
  backgroundUrl: games.backgroundUrl,
  releaseDate: games.releaseDate,
  developer: games.developer,
  publisher: games.publisher,
  igdbRating: games.igdbRating,
  igdbId: games.igdbId,
} as const;

// Genres groupes par game_id (une requete IN, assemblage en memoire). Evite N+1.
async function genresByGame(
  gameIds: string[],
): Promise<Map<string, GenreRef[]>> {
  const map = new Map<string, GenreRef[]>();
  if (gameIds.length === 0) return map;
  const rows = await db
    .select({
      gameId: gameGenres.gameId,
      id: genres.id,
      name: genres.name,
      slug: genres.slug,
    })
    .from(gameGenres)
    .innerJoin(genres, eq(gameGenres.genreId, genres.id))
    .where(inArray(gameGenres.gameId, gameIds));
  for (const r of rows) {
    const list = map.get(r.gameId) ?? [];
    list.push({ id: r.id, name: r.name, slug: r.slug });
    map.set(r.gameId, list);
  }
  return map;
}

// Tags (themes IGDB) groupes par game_id, meme principe.
async function tagsByGame(gameIds: string[]): Promise<Map<string, TagRef[]>> {
  const map = new Map<string, TagRef[]>();
  if (gameIds.length === 0) return map;
  const rows = await db
    .select({
      gameId: gameTags.gameId,
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
    })
    .from(gameTags)
    .innerJoin(tags, eq(gameTags.tagId, tags.id))
    .where(inArray(gameTags.gameId, gameIds));
  for (const r of rows) {
    const list = map.get(r.gameId) ?? [];
    list.push({ id: r.id, name: r.name, slug: r.slug });
    map.set(r.gameId, list);
  }
  return map;
}

// Liste paginee de la collection d'un user, genres/tags inline.
// view distingue la collection visible ("library", defaut : excluded_at IS
// NULL) des jeux ignores ("ignored" : excluded_at IS NOT NULL). Le statut
// n'est jamais touche par cette bascule, il reste affiche tel quel.
export async function listCollection(params: {
  userId: string;
  status?: GameStatus;
  search?: string;
  limit: number;
  offset: number;
  includeHidden: boolean;
  view?: "library" | "ignored";
}): Promise<{ items: CollectionItemDTO[]; total: number }> {
  const { userId, status, search, limit, offset, includeHidden, view = "library" } =
    params;
  const conds = [eq(userGames.userId, userId)];
  conds.push(
    view === "ignored"
      ? isNotNull(userGames.excludedAt)
      : isNull(userGames.excludedAt),
  );
  if (status) conds.push(eq(userGames.status, status));
  if (search) conds.push(ilike(games.title, `%${search}%`));
  if (!includeHidden) conds.push(eq(userGames.isHidden, false));
  const where = and(...conds);

  // total robuste — si search est présent, il faut joindre games pour le count aussi.
  const countQuery = db
    .select({ total: count() })
    .from(userGames)
    .$dynamic();
  const [{ total }] = await (search
    ? countQuery.innerJoin(games, eq(userGames.gameId, games.id)).where(where)
    : countQuery.where(where));
  if (total === 0) return { items: [], total: 0 };

  const rows = await db
    .select(ITEM_FIELDS)
    .from(userGames)
    .innerJoin(games, eq(userGames.gameId, games.id))
    .where(where)
    .orderBy(desc(userGames.createdAt))
    .limit(limit)
    .offset(offset);

  const ids = rows.map((r) => r.gameId);
  const [g, t] = await Promise.all([genresByGame(ids), tagsByGame(ids)]);
  const items = rows.map((r) =>
    toCollectionItemDTO(
      r as CollectionRow,
      g.get(r.gameId) ?? [],
      t.get(r.gameId) ?? [],
    ),
  );
  return { items, total };
}

// Detail d'un jeu de la collection : metadonnees completes + jeux similaires.
// Renvoie null si le jeu n'existe pas ou n'appartient pas au user (-> 404 route).
export async function getCollectionItem(
  userId: string,
  userGameId: string,
): Promise<CollectionDetailDTO | null> {
  const [row] = await db
    .select({ ...ITEM_FIELDS, description: games.description })
    .from(userGames)
    .innerJoin(games, eq(userGames.gameId, games.id))
    .where(and(eq(userGames.id, userGameId), eq(userGames.userId, userId)))
    .limit(1);
  if (!row) return null;

  const [g, t] = await Promise.all([
    genresByGame([row.gameId]),
    tagsByGame([row.gameId]),
  ]);

  // Similaires : game_similar pointe vers des igdb_id ; on ne resout que ceux
  // qu'on possede deja dans `games` (jointure games.igdbId = similarIgdbId).
  let similar: SimilarGameRef[] = [];
  if (row.igdbId !== null) {
    similar = await db
      .select({ id: games.id, title: games.title, coverUrl: games.coverUrl })
      .from(gameSimilar)
      .innerJoin(games, eq(games.igdbId, gameSimilar.similarIgdbId))
      .where(eq(gameSimilar.gameId, row.gameId));
  }

  return toCollectionDetailDTO(
    row as CollectionRow,
    g.get(row.gameId) ?? [],
    t.get(row.gameId) ?? [],
    similar,
  );
}

// Recharge un item complet (sans le detail) apres mutation.
// null si introuvable / non possede.
async function fetchItem(
  userId: string,
  userGameId: string,
): Promise<CollectionItemDTO | null> {
  const [row] = await db
    .select(ITEM_FIELDS)
    .from(userGames)
    .innerJoin(games, eq(userGames.gameId, games.id))
    .where(and(eq(userGames.id, userGameId), eq(userGames.userId, userId)))
    .limit(1);
  if (!row) return null;
  const [g, t] = await Promise.all([
    genresByGame([row.gameId]),
    tagsByGame([row.gameId]),
  ]);
  return toCollectionItemDTO(
    row as CollectionRow,
    g.get(row.gameId) ?? [],
    t.get(row.gameId) ?? [],
  );
}

// Edite les champs hors statut. On n'ecrit que les champs explicitement fournis
// (null = effacer la valeur, undefined = ne pas toucher au champ).
// Renvoie null si le jeu n'appartient pas au user.
export async function updateCollectionItem(
  userId: string,
  userGameId: string,
  input: UpdateUserGameInput,
): Promise<CollectionItemDTO | null> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (input.rating !== undefined) set.rating = input.rating;
  if (input.review !== undefined) set.review = input.review;
  if (input.playtimeMinutes !== undefined)
    set.playtimeMinutes = input.playtimeMinutes;
  if (input.isHidden !== undefined) set.isHidden = input.isHidden;

  const [updated] = await db
    .update(userGames)
    .set(set)
    .where(and(eq(userGames.id, userGameId), eq(userGames.userId, userId)))
    .returning({ id: userGames.id });
  if (!updated) return null;

  return fetchItem(userId, userGameId);
}

// Hard delete : retire definitivement le jeu de la collection. Les FK
// user_game_status_history / user_game_tags / external_achievements ->
// user_games sont ON DELETE CASCADE, l'historique et les tags du jeu partent
// automatiquement. Le catalogue `games` partage n'est pas touche.
// Renvoie false si rien n'a ete supprime (non possede).
export async function deleteCollectionItem(
  userId: string,
  userGameId: string,
): Promise<boolean> {
  const [deleted] = await db
    .delete(userGames)
    .where(and(eq(userGames.id, userGameId), eq(userGames.userId, userId)))
    .returning({ id: userGames.id });
  return !!deleted;
}

// Marque un jeu comme ignore : il disparait de la vue "library" (et d'un
// reimport type Steam) sans rien perdre -- statut, note, temps de jeu,
// historique restent intacts en base, prets a etre restaures.
// Renvoie false si le user_game n'existe pas ou n'appartient pas au user.
export async function ignoreUserGame(
  userId: string,
  userGameId: string,
): Promise<boolean> {
  const [updated] = await db
    .update(userGames)
    .set({ excludedAt: new Date() })
    .where(and(eq(userGames.id, userGameId), eq(userGames.userId, userId)))
    .returning({ id: userGames.id });
  return !!updated;
}

// Retire l'ignore : le jeu revient dans la vue "library" avec son statut
// intact (seul excluded_at est touche). Renvoie false si non possede.
export async function restoreUserGame(
  userId: string,
  userGameId: string,
): Promise<boolean> {
  const [updated] = await db
    .update(userGames)
    .set({ excludedAt: null })
    .where(and(eq(userGames.id, userGameId), eq(userGames.userId, userId)))
    .returning({ id: userGames.id });
  return !!updated;
}

// platformId est valide en amont comme UUID bien forme (schema Zod), mais un
// UUID syntaxiquement correct peut tres bien ne correspondre a aucune ligne
// platforms : sans ce garde-fou, l'insert plus bas part en violation de FK et
// remonte un 500 brut avec le message Postgres.
async function platformExists(platformId: string): Promise<boolean> {
  const [p] = await db
    .select({ id: platforms.id })
    .from(platforms)
    .where(eq(platforms.id, platformId))
    .limit(1);
  return !!p;
}

export type AddGameResult =
  | { ok: true; item: CollectionItemDTO }
  | { ok: false; reason: "game_not_found" | "platform_not_found" | "conflict" };

// Ajoute un jeu EXISTANT du catalogue a la collection (status backlog).
// serviceId = null : ajout manuel, pas de service connecte.
export async function addGameToCollection(
  userId: string,
  input: AddGameInput,
): Promise<AddGameResult> {
  const [g] = await db
    .select({ id: games.id })
    .from(games)
    .where(eq(games.id, input.gameId))
    .limit(1);
  if (!g) return { ok: false, reason: "game_not_found" };

  if (input.platformId && !(await platformExists(input.platformId))) {
    return { ok: false, reason: "platform_not_found" };
  }

  // La contrainte unique (userId, gameId, platformId) ne couvre pas le cas
  // platformId NULL (Postgres traite les NULL comme distincts) : on dedoublonne
  // explicitement, en gerant le NULL a part.
  const platformCond = input.platformId
    ? eq(userGames.platformId, input.platformId)
    : isNull(userGames.platformId);
  const [existing] = await db
    .select({ id: userGames.id, excludedAt: userGames.excludedAt })
    .from(userGames)
    .where(
      and(
        eq(userGames.userId, userId),
        eq(userGames.gameId, input.gameId),
        platformCond,
      ),
    )
    .limit(1);

  if (existing) {
    // Ligne deja active -> vrai doublon. Ligne ignoree -> l'user redemande ce
    // jeu explicitement, on la reactive plutot que de la dupliquer (le statut
    // et l'historique du jeu restent intacts, seul excluded_at bouge).
    if (existing.excludedAt === null) return { ok: false, reason: "conflict" };

    await db
      .update(userGames)
      .set({ excludedAt: null })
      .where(eq(userGames.id, existing.id));
    const item = await fetchItem(userId, existing.id);
    return { ok: true, item: item as CollectionItemDTO };
  }

  const [created] = await db
    .insert(userGames)
    .values({
      userId,
      gameId: input.gameId,
      platformId: input.platformId ?? null,
      serviceId: null,
      status: "backlog",
    })
    .returning({ id: userGames.id });

  // fetchItem ne peut pas renvoyer null ici : on vient d'inserer la ligne.
  const item = await fetchItem(userId, created.id);
  return { ok: true, item: item as CollectionItemDTO };
}

export type AddIgdbGameResult =
  | { ok: true; item: CollectionItemDTO }
  | { ok: false; reason: "conflict" | "igdb_not_found" | "platform_not_found" };

// Deps injectables (token + fetch IGDB), meme principe que igdb.discovery.service.ts :
// permet de tester ce flux sans reseau ni Redis reels.
export interface AddIgdbGameDeps {
  getToken(): Promise<string>;
  fetchGamesByIds: typeof fetchGamesByIds;
  enrich: typeof enrichGames;
}

function defaultAddIgdbGameDeps(): AddIgdbGameDeps {
  // Forme reduite de l'interface ioredis, suffisante ici et testable (mocks en test).
  const redisStore = redis as unknown as {
    get(k: string): Promise<string | null>;
    set(k: string, v: string, m: "EX", t: number): Promise<unknown>;
  };
  return {
    getToken: () =>
      getTwitchToken(
        process.env.TWITCH_CLIENT_ID ?? "",
        process.env.TWITCH_CLIENT_SECRET ?? "",
        redisStore,
      ),
    fetchGamesByIds,
    enrich: enrichGames,
  };
}

// Slugify helper, duplique volontairement (meme pattern que steam.service.ts et
// igdb.service.ts) : chaque module reste autonome, pas de dependance croisee
// pour un utilitaire aussi simple.
function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "game";
}

// Ajoute a la collection un jeu identifie par son igdbId, potentiellement absent
// de notre catalogue (cas : jeu trouve via la recherche IGDB live, Task 4, jamais
// encore ajoute par personne). Hydrate le catalogue au besoin avant de reutiliser
// addGameToCollection pour le reste (dedoublonnage, statut backlog...).
export async function addIgdbGameToCollection(
  userId: string,
  input: AddIgdbGameInput,
  clientId: string = process.env.TWITCH_CLIENT_ID ?? "",
  deps: AddIgdbGameDeps = defaultAddIgdbGameDeps(),
): Promise<AddIgdbGameResult> {
  const [existing] = await db
    .select({ id: games.id })
    .from(games)
    .where(eq(games.igdbId, input.igdbId))
    .limit(1);

  let gameId = existing?.id;

  if (!gameId) {
    const token = await deps.getToken();
    const [fetched] = await deps.fetchGamesByIds([input.igdbId], token, clientId);
    if (!fetched) return { ok: false, reason: "igdb_not_found" };

    gameId = await insertMinimalGameFromIgdb(fetched);
  }

  const result = await addGameToCollection(userId, {
    gameId,
    platformId: input.platformId,
  });
  if (!result.ok) {
    // On vient de garantir l'existence du jeu (trouve ou insere juste avant) :
    // game_not_found ici trahirait une incoherence, pas un cas metier attendu.
    if (result.reason === "game_not_found") {
      throw new Error(
        `Jeu ${gameId} introuvable juste apres resolution/insertion (igdbId=${input.igdbId})`,
      );
    }
    return { ok: false, reason: result.reason };
  }

  // Enrichissement complet en fire-and-forget (genres/tags/plateformes/note) :
  // l'ajout reste instantane, les metadonnees arrivent apres. Idempotent,
  // rattrape par le prochain enrichissement en cas d'echec.
  void deps.enrich({ userId }).catch(() => {
    /* best-effort : un echec sera rattrape au prochain declenchement */
  });

  return result;
}

// Insere une ligne `games` minimale a partir d'une fiche IGDB. Le slug suit le
// meme motif que hydrateGamesByIgdbIds (igdb.service.ts) pour rester coherent
// dans tout le catalogue : slugify(titre) + suffixe igdbId (garantit l'unicite).
async function insertMinimalGameFromIgdb(data: IgdbGame): Promise<string> {
  const releaseStatus =
    data.releaseDate && data.releaseDate > new Date().toISOString().slice(0, 10)
      ? "upcoming"
      : "released";
  const slug = `${slugify(data.name)}-igdb-${data.igdbId}`;

  const [created] = await db
    .insert(games)
    .values({
      title: data.name,
      slug,
      igdbId: data.igdbId,
      coverUrl: data.coverImageId ? igdbImageUrl(data.coverImageId, "t_cover_big") : null,
      description: data.summary,
      releaseDate: data.releaseDate,
      releaseStatus,
      developer: data.developer,
      publisher: data.publisher,
      // lastSyncedAt volontairement absent (reste NULL) : cet insert minimal n'a
      // jamais ete synchronise avec IGDB (genres/tags/plateformes/note manquants).
      // Le laisser NULL garantit que selectCandidates() (igdb.service.ts) selectionne
      // ce jeu des le prochain enrichGames, notamment le fire-and-forget declenche
      // juste apres par addIgdbGameToCollection. Le stamper ici rendrait ce
      // fire-and-forget no-op pendant STALE_DAYS (30 jours).
    })
    // Defense-in-depth : course possible avec un autre flux (ex. enrichGames) qui
    // aurait insere ce meme igdbId entretemps sous un slug different.
    .onConflictDoNothing({ target: games.slug })
    .returning({ id: games.id });

  if (created) return created.id;

  const [race] = await db
    .select({ id: games.id })
    .from(games)
    .where(eq(games.igdbId, data.igdbId))
    .limit(1);
  if (!race) {
    throw new Error(`Echec insertion du jeu IGDB ${data.igdbId} (collision de slug)`);
  }
  return race.id;
}

import {
  db,
  connectedServices,
  services,
  platforms,
  games,
  userGames,
} from "@nextquest/db";
import { and, eq, sql } from "drizzle-orm";
import type { SteamOwnedGame } from "./steam.client.js";

export interface SteamConnection {
  steamId: string;
  personaName: string | null;
}

// Slug deterministe et unique : on suffixe l'appid (unique) pour eviter toute
// collision de slug entre deux jeux homonymes. IGDB pourra l'affiner plus tard.
function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "game";
}

async function getServiceId(code: string): Promise<string> {
  const [row] = await db
    .select({ id: services.id })
    .from(services)
    .where(eq(services.code, code))
    .limit(1);
  if (!row) {
    throw new Error(`Service "${code}" introuvable (migration de reference manquante)`);
  }
  return row.id;
}

async function getPlatformId(code: string): Promise<string> {
  const [row] = await db
    .select({ id: platforms.id })
    .from(platforms)
    .where(eq(platforms.code, code))
    .limit(1);
  if (!row) {
    throw new Error(`Plateforme "${code}" introuvable (migration de reference manquante)`);
  }
  return row.id;
}

// Lie (ou met a jour) le compte Steam de l'utilisateur. Idempotent grace a la
// contrainte unique (user_id, service_id).
export async function linkSteamAccount(
  userId: string,
  steamId: string,
  personaName: string | null,
): Promise<SteamConnection> {
  const serviceId = await getServiceId("steam");

  await db
    .insert(connectedServices)
    .values({
      userId,
      serviceId,
      externalUserId: steamId,
      externalUsername: personaName,
    })
    .onConflictDoUpdate({
      target: [connectedServices.userId, connectedServices.serviceId],
      set: {
        externalUserId: steamId,
        externalUsername: personaName,
        updatedAt: new Date(),
      },
    });

  return { steamId, personaName };
}

export async function getSteamConnection(
  userId: string,
): Promise<SteamConnection | null> {
  const serviceId = await getServiceId("steam");

  const [row] = await db
    .select({
      steamId: connectedServices.externalUserId,
      personaName: connectedServices.externalUsername,
    })
    .from(connectedServices)
    .where(
      and(
        eq(connectedServices.userId, userId),
        eq(connectedServices.serviceId, serviceId),
      ),
    )
    .limit(1);

  return row ?? null;
}

// Supprime le lien Steam. Renvoie true si un lien existait.
export async function unlinkSteamAccount(userId: string): Promise<boolean> {
  const serviceId = await getServiceId("steam");

  const deleted = await db
    .delete(connectedServices)
    .where(
      and(
        eq(connectedServices.userId, userId),
        eq(connectedServices.serviceId, serviceId),
      ),
    )
    .returning({ id: connectedServices.id });

  return deleted.length > 0;
}

// Upsert de la bibliotheque dans games (par steam_appid) + user_games (par
// user/game/platform). Idempotent : un reimport met a jour les heures jouees.
// Renvoie le nombre de jeux traites.
//
// Tout passe en deux requetes groupees (et non 2 par jeu) : une grosse biblio
// Steam (plusieurs centaines de jeux) tient ainsi largement sous la contrainte
// de 3s, la ou des allers-retours en boucle l'auraient fait exploser.
export async function importSteamLibrary(
  userId: string,
  ownedGames: SteamOwnedGame[],
): Promise<number> {
  if (ownedGames.length === 0) return 0;

  const serviceId = await getServiceId("steam");
  const platformId = await getPlatformId("pc");

  // Un meme appid deux fois dans un INSERT ... ON CONFLICT leve une erreur
  // Postgres ("cannot affect row a second time"). Steam ne devrait pas renvoyer
  // de doublon, mais on dedoublonne par securite (le dernier l'emporte).
  const uniqueByAppid = new Map<number, SteamOwnedGame>();
  for (const g of ownedGames) uniqueByAppid.set(g.appid, g);
  const items = [...uniqueByAppid.values()];

  // Transaction : un import est tout-ou-rien, jamais a moitie ecrit.
  return db.transaction(async (tx) => {
    // 1) Upsert groupe des jeux. RETURNING renvoie aussi les lignes mises a
    // jour (ON CONFLICT DO UPDATE), donc on recupere l'id de chaque appid.
    const gameRows = await tx
      .insert(games)
      .values(
        items.map((g) => ({
          steamAppid: g.appid,
          title: g.name,
          slug: `${slugify(g.name)}-${g.appid}`,
        })),
      )
      .onConflictDoUpdate({
        target: games.steamAppid,
        set: {
          title: sql.raw(`excluded.${games.title.name}`),
          updatedAt: new Date(),
        },
      })
      .returning({ id: games.id, steamAppid: games.steamAppid });

    const idByAppid = new Map<number, string>();
    for (const row of gameRows) {
      if (row.steamAppid !== null) idByAppid.set(row.steamAppid, row.id);
    }

    // 2) Upsert groupe des user_games. Le temps de jeu est repris de la valeur
    // proposee (excluded) en cas de reimport.
    await tx
      .insert(userGames)
      .values(
        items.map((g) => ({
          userId,
          gameId: idByAppid.get(g.appid)!,
          serviceId,
          platformId,
          playtimeMinutes: g.playtimeMinutes,
          // Classification initiale sans friction : un jeu deja lance arrive
          // "en cours", un jeu jamais lance reste "a faire". L'user n'ajuste que
          // les exceptions (termines / abandonnes). Steam n'expose pas de date
          // de premiere partie, donc pas de started_at ici.
          status: (g.playtimeMinutes > 0 ? "playing" : "backlog") as
            | "playing"
            | "backlog",
        })),
      )
      .onConflictDoUpdate({
        target: [userGames.userId, userGames.gameId, userGames.platformId],
        set: {
          // status volontairement absent du set : un reimport ne doit jamais
          // reecrire le statut que l'user a ajuste depuis l'import initial.
          playtimeMinutes: sql.raw(
            `excluded.${userGames.playtimeMinutes.name}`,
          ),
          updatedAt: new Date(),
        },
      });

    return items.length;
  });
}

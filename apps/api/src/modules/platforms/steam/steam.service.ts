import {
  db,
  connectedServices,
  services,
  platforms,
  games,
  userGames,
} from "@nextquest/db";
import { and, eq } from "drizzle-orm";
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
export async function importSteamLibrary(
  userId: string,
  ownedGames: SteamOwnedGame[],
): Promise<number> {
  if (ownedGames.length === 0) return 0;

  const serviceId = await getServiceId("steam");
  const platformId = await getPlatformId("pc");

  let count = 0;
  for (const g of ownedGames) {
    const [game] = await db
      .insert(games)
      .values({
        steamAppid: g.appid,
        title: g.name,
        slug: `${slugify(g.name)}-${g.appid}`,
      })
      .onConflictDoUpdate({
        target: games.steamAppid,
        set: { title: g.name, updatedAt: new Date() },
      })
      .returning({ id: games.id });

    await db
      .insert(userGames)
      .values({
        userId,
        gameId: game.id,
        serviceId,
        platformId,
        playtimeMinutes: g.playtimeMinutes,
      })
      .onConflictDoUpdate({
        target: [userGames.userId, userGames.gameId, userGames.platformId],
        set: { playtimeMinutes: g.playtimeMinutes, updatedAt: new Date() },
      });

    count++;
  }

  return count;
}

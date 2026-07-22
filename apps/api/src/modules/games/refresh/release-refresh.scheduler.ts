// Declencheur quotidien du rafraichissement des sorties. In-process : pas
// d'infra en plus au stade actuel. Le verrou Redis garantit un seul run meme
// avec plusieurs instances API (deploiement futur) ; TTL largement superieur a
// la duree max d'un run pour eviter tout deadlock apres un crash. Migration
// prevue si besoin : brancher runReleaseRefreshWithLock sur un worker BullMQ.
import type { FastifyBaseLogger } from "fastify";
import { redis } from "../../../lib/redis.js";
import { refreshUpcomingReleases, type RefreshSummary } from "./release-refresh.service.js";

export const RELEASE_REFRESH_LOCK_KEY = "locks:release-refresh";
const LOCK_TTL_SECONDS = 3600;

export async function runReleaseRefreshWithLock(
  log: FastifyBaseLogger,
  run: () => Promise<RefreshSummary> = () => refreshUpcomingReleases(),
): Promise<RefreshSummary | null> {
  const acquired = await redis.set(RELEASE_REFRESH_LOCK_KEY, "1", "EX", LOCK_TTL_SECONDS, "NX");
  if (acquired !== "OK") {
    log.info("refresh sorties : verrou deja pris, run saute");
    return null;
  }
  try {
    const summary = await run();
    log.info(summary, "refresh sorties termine");
    return summary;
  } finally {
    await redis.del(RELEASE_REFRESH_LOCK_KEY);
  }
}

export function scheduleReleaseRefresh(log: FastifyBaseLogger): void {
  if (process.env.RELEASE_REFRESH_ENABLED !== "true") return;
  const hour = Number(process.env.RELEASE_REFRESH_HOUR ?? 6);

  const scheduleNext = () => {
    const now = new Date();
    const next = new Date(now);
    next.setHours(hour, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    const timer = setTimeout(async () => {
      try {
        await runReleaseRefreshWithLock(log);
      } catch (err) {
        log.error({ err }, "refresh sorties : run en echec, prochain essai demain");
      }
      scheduleNext();
    }, next.getTime() - now.getTime());
    // Ne pas retenir le process (tests, arret propre).
    timer.unref();
  };
  scheduleNext();
}

// Declencheur quotidien de la purge RGPD des comptes en fin de grace. In-process :
// pas d'infra en plus au stade actuel. Le verrou Redis garantit un seul run meme
// avec plusieurs instances API (deploiement futur) ; TTL largement superieur a
// la duree max d'un run pour eviter tout deadlock apres un crash. Migration
// prevue si besoin : brancher runAccountPurgeWithLock sur un worker BullMQ.
import type { FastifyBaseLogger } from "fastify";
import { redis } from "../../lib/redis.js";
import { purgeExpiredAccounts, type PurgeSummary } from "./purge.service.js";

export const ACCOUNT_PURGE_LOCK_KEY = "locks:account-purge";
const LOCK_TTL_SECONDS = 3600;

export async function runAccountPurgeWithLock(
  log: FastifyBaseLogger,
  run: () => Promise<PurgeSummary> = () => purgeExpiredAccounts(log),
): Promise<PurgeSummary | null> {
  const acquired = await redis.set(ACCOUNT_PURGE_LOCK_KEY, "1", "EX", LOCK_TTL_SECONDS, "NX");
  if (acquired !== "OK") {
    log.info("purge comptes : verrou deja pris, run saute");
    return null;
  }
  try {
    const summary = await run();
    log.info(summary, "purge comptes terminee");
    return summary;
  } finally {
    await redis.del(ACCOUNT_PURGE_LOCK_KEY);
  }
}

export function scheduleAccountPurge(log: FastifyBaseLogger): void {
  if (process.env.ACCOUNT_PURGE_ENABLED !== "true") return;
  const rawHour = process.env.ACCOUNT_PURGE_HOUR ?? "5";
  const hour = Number(rawHour);

  // Une valeur invalide (ex. "5h") donnerait NaN -> setHours(NaN) -> Invalid Date
  // -> setTimeout(fn, NaN) demarre en ~1ms : boucle chaude de purge en continu.
  // On coupe le scheduler plutot que de marteler la BDD et le storage.
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    log.error(
      { rawHour },
      "purge comptes : ACCOUNT_PURGE_HOUR invalide, scheduler desactive",
    );
    return;
  }

  const scheduleNext = () => {
    const now = new Date();
    const next = new Date(now);
    next.setHours(hour, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    const timer = setTimeout(async () => {
      try {
        await runAccountPurgeWithLock(log);
      } catch (err) {
        log.error({ err }, "purge comptes : run en echec, prochain essai demain");
      }
      scheduleNext();
    }, next.getTime() - now.getTime());
    // Ne pas retenir le process (tests, arret propre).
    timer.unref();
  };
  scheduleNext();
}

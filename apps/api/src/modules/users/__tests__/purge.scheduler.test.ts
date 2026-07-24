import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { redis } from "../../../lib/redis.js";
import {
  runAccountPurgeWithLock,
  scheduleAccountPurge,
  ACCOUNT_PURGE_LOCK_KEY,
} from "../purge.scheduler.js";

const noopLog = { info: vi.fn(), error: vi.fn() } as never;

beforeEach(async () => {
  await redis.del(ACCOUNT_PURGE_LOCK_KEY);
});

describe("runAccountPurgeWithLock", () => {
  it("pose le verrou et lance le run", async () => {
    const run = vi.fn(async () => ({ purged: 0, skipped: 0 }));
    const summary = await runAccountPurgeWithLock(noopLog, run);
    expect(run).toHaveBeenCalledOnce();
    expect(summary).toEqual({ purged: 0, skipped: 0 });
  });

  it("ne lance rien si le verrou est deja pris (autre instance)", async () => {
    await redis.set(ACCOUNT_PURGE_LOCK_KEY, "1", "EX", 60);
    const run = vi.fn(async () => ({ purged: 0, skipped: 0 }));
    const summary = await runAccountPurgeWithLock(noopLog, run);
    expect(run).not.toHaveBeenCalled();
    expect(summary).toBeNull();
  });

  it("ne supprime pas le verrou d'une autre instance quand il est deja pris", async () => {
    await redis.set(ACCOUNT_PURGE_LOCK_KEY, "1", "EX", 60);
    const run = vi.fn(async () => ({ purged: 0, skipped: 0 }));
    await runAccountPurgeWithLock(noopLog, run);
    expect(await redis.get(ACCOUNT_PURGE_LOCK_KEY)).toBe("1");
  });

  it("relache le verrou meme si le run echoue", async () => {
    const run = vi.fn(async () => {
      throw new Error("boom");
    });
    await expect(runAccountPurgeWithLock(noopLog, run)).rejects.toThrow("boom");
    expect(await redis.get(ACCOUNT_PURGE_LOCK_KEY)).toBeNull();
  });
});

describe("scheduleAccountPurge (garde-fou ACCOUNT_PURGE_HOUR)", () => {
  const originalEnabled = process.env.ACCOUNT_PURGE_ENABLED;
  const originalHour = process.env.ACCOUNT_PURGE_HOUR;

  afterEach(() => {
    if (originalEnabled === undefined) delete process.env.ACCOUNT_PURGE_ENABLED;
    else process.env.ACCOUNT_PURGE_ENABLED = originalEnabled;
    if (originalHour === undefined) delete process.env.ACCOUNT_PURGE_HOUR;
    else process.env.ACCOUNT_PURGE_HOUR = originalHour;
  });

  it("ne cree aucun timer et logge une erreur si ACCOUNT_PURGE_HOUR est invalide", () => {
    process.env.ACCOUNT_PURGE_ENABLED = "true";
    process.env.ACCOUNT_PURGE_HOUR = "abc";
    const log = { info: vi.fn(), error: vi.fn() } as never;
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    scheduleAccountPurge(log);

    expect(setTimeoutSpy).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledOnce();

    setTimeoutSpy.mockRestore();
  });

  it("ne fait rien si ACCOUNT_PURGE_ENABLED n'est pas 'true'", () => {
    delete process.env.ACCOUNT_PURGE_ENABLED;
    process.env.ACCOUNT_PURGE_HOUR = "5";
    const log = { info: vi.fn(), error: vi.fn() } as never;
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    scheduleAccountPurge(log);

    expect(setTimeoutSpy).not.toHaveBeenCalled();

    setTimeoutSpy.mockRestore();
  });
});

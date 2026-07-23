import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { redis } from "../../../../lib/redis.js";
import {
  runReleaseRefreshWithLock,
  scheduleReleaseRefresh,
  RELEASE_REFRESH_LOCK_KEY,
} from "../release-refresh.scheduler.js";

const noopLog = { info: vi.fn(), error: vi.fn() } as never;

beforeEach(async () => {
  await redis.del(RELEASE_REFRESH_LOCK_KEY);
});

describe("runReleaseRefreshWithLock", () => {
  it("pose le verrou et lance le run", async () => {
    const run = vi.fn(async () => ({ checked: 0, updated: 0, failedBatches: 0, failedGames: 0 }));
    const summary = await runReleaseRefreshWithLock(noopLog, run);
    expect(run).toHaveBeenCalledOnce();
    expect(summary).toEqual({ checked: 0, updated: 0, failedBatches: 0, failedGames: 0 });
  });

  it("ne lance rien si le verrou est deja pris (autre instance)", async () => {
    await redis.set(RELEASE_REFRESH_LOCK_KEY, "1", "EX", 60);
    const run = vi.fn(async () => ({ checked: 0, updated: 0, failedBatches: 0, failedGames: 0 }));
    const summary = await runReleaseRefreshWithLock(noopLog, run);
    expect(run).not.toHaveBeenCalled();
    expect(summary).toBeNull();
  });
});

describe("scheduleReleaseRefresh (garde-fou RELEASE_REFRESH_HOUR)", () => {
  const originalEnabled = process.env.RELEASE_REFRESH_ENABLED;
  const originalHour = process.env.RELEASE_REFRESH_HOUR;

  afterEach(() => {
    if (originalEnabled === undefined) delete process.env.RELEASE_REFRESH_ENABLED;
    else process.env.RELEASE_REFRESH_ENABLED = originalEnabled;
    if (originalHour === undefined) delete process.env.RELEASE_REFRESH_HOUR;
    else process.env.RELEASE_REFRESH_HOUR = originalHour;
  });

  it("ne cree aucun timer et logge une erreur si RELEASE_REFRESH_HOUR est invalide", () => {
    process.env.RELEASE_REFRESH_ENABLED = "true";
    process.env.RELEASE_REFRESH_HOUR = "abc";
    const log = { info: vi.fn(), error: vi.fn() } as never;
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    scheduleReleaseRefresh(log);

    expect(setTimeoutSpy).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledOnce();

    setTimeoutSpy.mockRestore();
  });
});

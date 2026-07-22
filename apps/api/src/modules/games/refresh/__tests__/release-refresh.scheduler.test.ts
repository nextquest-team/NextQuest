import { describe, it, expect, beforeEach, vi } from "vitest";
import { redis } from "../../../../lib/redis.js";
import { runReleaseRefreshWithLock, RELEASE_REFRESH_LOCK_KEY } from "../release-refresh.scheduler.js";

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

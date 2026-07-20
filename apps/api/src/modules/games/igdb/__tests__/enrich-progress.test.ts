import { describe, it, expect, beforeEach, vi } from "vitest";

// Redis mocke : store en memoire, get/set/del suffisent pour ces helpers.
const store = new Map<string, string>();
vi.mock("../../../../lib/redis.js", () => ({
  redis: {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return "OK";
    }),
  },
}));

import { redis } from "../../../../lib/redis.js";
import {
  progressKey,
  markEnrichStart,
  markEnrichDone,
  readEnrichProgress,
} from "../enrich-progress.js";

const mockedGet = vi.mocked(redis.get);
const mockedSet = vi.mocked(redis.set);

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

describe("progressKey", () => {
  it("construit la cle namespacee par user", () => {
    expect(progressKey("user-1")).toBe("enrich:progress:user-1");
  });
});

describe("markEnrichStart / readEnrichProgress", () => {
  it("ecrit un statut running avec le total et le relit", async () => {
    await markEnrichStart("user-1", 42);

    const progress = await readEnrichProgress("user-1");
    expect(progress).not.toBeNull();
    expect(progress?.status).toBe("running");
    expect(progress?.total).toBe(42);
    expect(typeof progress?.startedAt).toBe("number");
  });

  it("pose un TTL de 600s", async () => {
    await markEnrichStart("user-1", 10);
    expect(mockedSet).toHaveBeenCalledWith(
      progressKey("user-1"),
      expect.any(String),
      "EX",
      600,
    );
  });
});

describe("markEnrichDone", () => {
  it("relit la progression et passe le statut a done en gardant total/startedAt", async () => {
    await markEnrichStart("user-1", 7);
    const before = await readEnrichProgress("user-1");

    await markEnrichDone("user-1");

    const after = await readEnrichProgress("user-1");
    expect(after?.status).toBe("done");
    expect(after?.total).toBe(7);
    expect(after?.startedAt).toBe(before?.startedAt);
  });

  it("ne fait rien si aucune progression n'existait (pas de start prealable)", async () => {
    await markEnrichDone("user-inconnu");
    const progress = await readEnrichProgress("user-inconnu");
    expect(progress).toBeNull();
  });
});

describe("readEnrichProgress", () => {
  it("renvoie null si aucune progression n'est enregistree", async () => {
    const progress = await readEnrichProgress("jamais-vu");
    expect(progress).toBeNull();
  });
});

describe("best-effort (erreurs Redis avalees)", () => {
  it("markEnrichStart ne throw pas si Redis echoue", async () => {
    mockedSet.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(markEnrichStart("user-1", 1)).resolves.toBeUndefined();
  });

  it("markEnrichDone ne throw pas si Redis echoue", async () => {
    await markEnrichStart("user-1", 1);
    mockedGet.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(markEnrichDone("user-1")).resolves.toBeUndefined();
  });

  it("readEnrichProgress renvoie null si Redis echoue", async () => {
    mockedGet.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(readEnrichProgress("user-1")).resolves.toBeNull();
  });
});

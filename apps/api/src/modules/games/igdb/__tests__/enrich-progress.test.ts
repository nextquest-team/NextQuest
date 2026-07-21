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
    await markEnrichStart("user-1", ["g1", "g2"]);

    const progress = await readEnrichProgress("user-1");
    expect(progress).not.toBeNull();
    expect(progress?.status).toBe("running");
    expect(progress?.total).toBe(2);
    expect(progress?.gameIds).toEqual(["g1", "g2"]);
    expect(typeof progress?.startedAt).toBe("number");
    expect(typeof progress?.runId).toBe("string");
  });

  it("pose un TTL de 600s", async () => {
    await markEnrichStart("user-1", ["g1"]);
    expect(mockedSet).toHaveBeenCalledWith(
      progressKey("user-1"),
      expect.any(String),
      "EX",
      600,
    );
  });

  it("genere un runId different a chaque appel", async () => {
    const runId1 = await markEnrichStart("user-1", ["g1"]);
    const runId2 = await markEnrichStart("user-1", ["g1"]);
    expect(runId1).not.toBe(runId2);
  });
});

describe("markEnrichDone", () => {
  it("relit la progression et passe le statut a done en gardant total/startedAt", async () => {
    const runId = await markEnrichStart("user-1", ["g1", "g2", "g3"]);
    const before = await readEnrichProgress("user-1");

    await markEnrichDone("user-1", runId);

    const after = await readEnrichProgress("user-1");
    expect(after?.status).toBe("done");
    expect(after?.total).toBe(3);
    expect(after?.startedAt).toBe(before?.startedAt);
  });

  it("ne fait rien si aucune progression n'existait (pas de start prealable)", async () => {
    await markEnrichDone("user-inconnu", "runId-fantome");
    const progress = await readEnrichProgress("user-inconnu");
    expect(progress).toBeNull();
  });

  // Fix #3 : deux enrichissements qui se chevauchent pour le meme user (ex.
  // import Steam + trigger manuel) ne doivent pas se marcher dessus. Le run
  // qui se termine en retard ne doit ni cloturer ni ecraser le run plus recent.
  it("ne cloture pas un run plus recent si un runId perime tente de clore apres coup", async () => {
    const runId1 = await markEnrichStart("user-1", ["g1"]);
    const runId2 = await markEnrichStart("user-1", ["g2", "g3"]);

    // Le run 1 (demarre en premier) se termine en dernier : son markEnrichDone
    // arrive apres que le run 2 a deja pris la main sur la cle Redis.
    await markEnrichDone("user-1", runId1);

    const progress = await readEnrichProgress("user-1");
    expect(progress?.runId).toBe(runId2);
    expect(progress?.status).toBe("running");
    expect(progress?.total).toBe(2);
    expect(progress?.gameIds).toEqual(["g2", "g3"]);
  });

  it("cloture bien le run courant quand le runId correspond", async () => {
    await markEnrichStart("user-1", ["g1"]);
    const runId2 = await markEnrichStart("user-1", ["g2", "g3"]);

    await markEnrichDone("user-1", runId2);

    const progress = await readEnrichProgress("user-1");
    expect(progress?.runId).toBe(runId2);
    expect(progress?.status).toBe("done");
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
    await expect(markEnrichStart("user-1", ["g1"])).resolves.toEqual(
      expect.any(String),
    );
  });

  it("markEnrichDone ne throw pas si Redis echoue", async () => {
    const runId = await markEnrichStart("user-1", ["g1"]);
    mockedGet.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(markEnrichDone("user-1", runId)).resolves.toBeUndefined();
  });

  it("readEnrichProgress renvoie null si Redis echoue", async () => {
    mockedGet.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(readEnrichProgress("user-1")).resolves.toBeNull();
  });
});

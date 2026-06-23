import { describe, it, expect, vi } from "vitest";
import { withDbRetry, isTransientConnectionError } from "@nextquest/db";

function connErr(code: string): Error {
  return Object.assign(new Error(code), { code });
}

const noSleep = () => Promise.resolve();

describe("isTransientConnectionError", () => {
  it("reconnait les codes de connexion transitoires", () => {
    expect(isTransientConnectionError(connErr("CONNECTION_CLOSED"))).toBe(true);
    expect(isTransientConnectionError(connErr("ECONNRESET"))).toBe(true);
  });

  it("ignore les autres erreurs (ex. violation de contrainte)", () => {
    expect(isTransientConnectionError(connErr("23505"))).toBe(false);
    expect(isTransientConnectionError(new Error("boom"))).toBe(false);
    expect(isTransientConnectionError(null)).toBe(false);
  });

  it("regarde aussi err.cause.code (erreur encapsulee par drizzle)", () => {
    expect(isTransientConnectionError({ cause: { code: "CONNECTION_CLOSED" } })).toBe(true);
  });
});

describe("withDbRetry", () => {
  it("renvoie le resultat sans retry si succes immediat", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    expect(await withDbRetry(fn, { sleep: noSleep })).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retente sur erreur de connexion transitoire puis reussit", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(connErr("CONNECTION_CLOSED"))
      .mockResolvedValue("ok");
    const sleep = vi.fn(noSleep);
    expect(await withDbRetry(fn, { sleep })).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("abandonne apres le nombre de tentatives et propage la derniere erreur", async () => {
    const fn = vi.fn().mockRejectedValue(connErr("CONNECTION_CLOSED"));
    await expect(withDbRetry(fn, { attempts: 3, sleep: noSleep })).rejects.toThrow(
      "CONNECTION_CLOSED",
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("ne retente pas une erreur non transitoire (remonte tout de suite)", async () => {
    const fn = vi.fn().mockRejectedValue(connErr("23505")); // unique_violation
    await expect(withDbRetry(fn, { sleep: noSleep })).rejects.toThrow("23505");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

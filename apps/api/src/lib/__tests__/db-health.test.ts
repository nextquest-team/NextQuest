import { describe, it, expect } from "vitest";
import { assertDbReachable } from "@nextquest/db";

// 192.0.2.1 = TEST-NET-1 (RFC 5737), non routé -> les SYN partent sans réponse,
// ce qui simule un host Postgres qui ne répond pas (stack Docker éteinte / Tailscale
// coupé). Sans connect_timeout, la connexion pendrait indéfiniment (bug #64).
const UNREACHABLE = "postgresql://nextquest:nextquest@192.0.2.1:5432/nextquest";

describe("assertDbReachable", () => {
  it(
    "rejette quand le host est injoignable, avant le timeout court (échec rapide)",
    async () => {
      await expect(assertDbReachable(UNREACHABLE, 1)).rejects.toThrow(/injoignable/i);
    },
    10000,
  );

  it(
    "le message d'erreur inclut le host:port et le conseil de lancer Docker",
    async () => {
      await expect(assertDbReachable(UNREACHABLE, 1)).rejects.toThrow(/192\.0\.2\.1:5432/);
      await expect(assertDbReachable(UNREACHABLE, 1)).rejects.toThrow(/docker/i);
    },
    10000,
  );

  it("lève si DATABASE_URL est absent", async () => {
    await expect(assertDbReachable("", 1)).rejects.toThrow(/DATABASE_URL/);
  });
});

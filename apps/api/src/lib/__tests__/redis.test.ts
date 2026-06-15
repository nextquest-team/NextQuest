import { describe, it, expect } from "vitest";
import { redis } from "../redis.js";

describe("redis client", () => {
  it("set/get round-trip avec expiration", async () => {
    await redis.set("nq:test:key", "hello", "EX", 60);
    expect(await redis.get("nq:test:key")).toBe("hello");
    await redis.del("nq:test:key");
  });
});

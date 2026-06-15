import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { registerJwt } from "../../plugins/jwt.js";
import { requireAuth, requireAdmin } from "../guards.js";

async function buildApp() {
  const app = Fastify();
  await registerJwt(app);
  app.get(
    "/admin-only",
    { onRequest: [requireAuth, requireAdmin] },
    async () => ({ ok: true }),
  );
  await app.ready();
  return app;
}

describe("requireAdmin", () => {
  it("401 sans token", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/admin-only" });
    expect(res.statusCode).toBe(401);
  });

  it("403 pour un user non admin", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({ sub: "u1", role: "user" });
    const res = await app.inject({
      method: "GET",
      url: "/admin-only",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("200 pour un admin", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({ sub: "u1", role: "admin" });
    const res = await app.inject({
      method: "GET",
      url: "/admin-only",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });
});

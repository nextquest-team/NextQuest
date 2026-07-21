import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import { db, users, games } from "@nextquest/db";
import { validatorCompiler, serializerCompiler } from "fastify-type-provider-zod";
import { registerJwt } from "../../../plugins/jwt.js";
import { registerErrorHandler } from "../../../lib/error-handler.js";
import { registerSwagger } from "../../../plugins/swagger.js";
import { gamesRoutes } from "../games.routes.js";

async function buildApp() {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);
  await registerSwagger(app);
  await registerJwt(app);
  await app.register(gamesRoutes, { prefix: "/api" });
  await app.ready();
  return app;
}

async function cleanup() {
  await db.delete(games);
  await db.delete(users);
}
beforeEach(cleanup);

describe("GET /api/games", () => {
  it("401 sans JWT", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/games?search=halo" });
    expect(res.statusCode).toBe(401);
  });
  it("400 si search < 2 caracteres", async () => {
    const app = await buildApp();
    const [u] = await db
      .insert(users)
      .values({ email: "g@test.com", username: "g", passwordHash: "x" })
      .returning({ id: users.id });
    const token = app.jwt.sign({ sub: u.id });
    const res = await app.inject({
      method: "GET",
      url: "/api/games?search=h",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
  });
  it("200 et renvoie les jeux matches", async () => {
    const app = await buildApp();
    const [u] = await db
      .insert(users)
      .values({ email: "g2@test.com", username: "g2", passwordHash: "x" })
      .returning({ id: users.id });
    await db
      .insert(games)
      .values({ title: "Halo Infinite", slug: "halo-1", visibility: "public" });
    const token = app.jwt.sign({ sub: u.id });
    const res = await app.inject({
      method: "GET",
      url: "/api/games?search=halo",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).total).toBe(1);
  });
});

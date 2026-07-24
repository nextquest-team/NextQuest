import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import { hash } from "argon2";
import { eq } from "drizzle-orm";
import { validatorCompiler, serializerCompiler } from "fastify-type-provider-zod";
import { db, users, sessions, gdprRequests } from "@nextquest/db";
import { registerJwt } from "../../../plugins/jwt.js";
import { registerErrorHandler } from "../../../lib/error-handler.js";
import { registerSwagger } from "../../../plugins/swagger.js";
import { accountDeletionRoutes } from "../account-deletion.routes.js";

async function buildApp() {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);
  await registerSwagger(app);
  await registerJwt(app);
  await app.register(accountDeletionRoutes, { prefix: "/api" });
  await app.ready();
  return app;
}

const PASSWORD = "Sup3r-Secret!";

async function createLocalUser() {
  const [user] = await db
    .insert(users)
    .values({
      email: `delr-${Date.now()}-${Math.random()}@test.com`,
      username: `delr${Date.now()}${Math.floor(Math.random() * 1000)}`,
      passwordHash: await hash(PASSWORD),
    })
    .returning();
  return user;
}

async function createOauthUser() {
  const [user] = await db
    .insert(users)
    .values({
      email: `delo-${Date.now()}-${Math.random()}@test.com`,
      username: `delo${Date.now()}${Math.floor(Math.random() * 1000)}`,
      passwordHash: null,
    })
    .returning();
  return user;
}

function getToken(app: Awaited<ReturnType<typeof buildApp>>, userId: string) {
  return app.jwt.sign({ sub: userId, role: "user" }, { expiresIn: "15m" });
}

beforeEach(async () => {
  await db.delete(gdprRequests);
  await db.delete(sessions);
  await db.delete(users);
});

describe("DELETE /api/users/me", () => {
  it("401 sans token", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "DELETE", url: "/api/users/me" });
    expect(res.statusCode).toBe(401);
  });

  it("400 : compte local sans mot de passe fourni", async () => {
    const app = await buildApp();
    const user = await createLocalUser();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/users/me",
      headers: { authorization: `Bearer ${getToken(app, user.id)}` },
    });
    expect(res.statusCode).toBe(400);
    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row.deletedAt).toBeNull();
  });

  it("401 : compte local avec mauvais mot de passe", async () => {
    const app = await buildApp();
    const user = await createLocalUser();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/users/me",
      headers: { authorization: `Bearer ${getToken(app, user.id)}`, "content-type": "application/json" },
      payload: { password: "faux-mdp" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("200 : compte local avec bon mot de passe -> grace posee", async () => {
    const app = await buildApp();
    const user = await createLocalUser();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/users/me",
      headers: { authorization: `Bearer ${getToken(app, user.id)}`, "content-type": "application/json" },
      payload: { password: PASSWORD },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(new Date(body.purgeAfter).getTime()).toBeGreaterThan(new Date(body.deletedAt).getTime());
    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row.deletedAt).not.toBeNull();
  });

  it("200 : compte OAuth pur sans body", async () => {
    const app = await buildApp();
    const user = await createOauthUser();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/users/me",
      headers: { authorization: `Bearer ${getToken(app, user.id)}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("200 idempotent : re-DELETE renvoie le meme purgeAfter", async () => {
    const app = await buildApp();
    const user = await createOauthUser();
    const token = getToken(app, user.id);
    const first = await app.inject({ method: "DELETE", url: "/api/users/me", headers: { authorization: `Bearer ${token}` } });
    const second = await app.inject({ method: "DELETE", url: "/api/users/me", headers: { authorization: `Bearer ${token}` } });
    expect(second.statusCode).toBe(200);
    expect(second.json().purgeAfter).toBe(first.json().purgeAfter);
  });
});

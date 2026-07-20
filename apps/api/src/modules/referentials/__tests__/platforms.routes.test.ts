import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import { db, platforms, users } from "@nextquest/db";
import { eq, inArray } from "drizzle-orm";
import { validatorCompiler } from "fastify-type-provider-zod";
import { registerJwt } from "../../../plugins/jwt.js";
import { registerErrorHandler } from "../../../lib/error-handler.js";
import { registerSwagger } from "../../../plugins/swagger.js";
import { platformsRoutes } from "../platforms.routes.js";

// Codes dedies a ce test : "platforms" est un referentiel partage (donnees reelles
// deja presentes en base dev, referencees par user_games en ON DELETE RESTRICT).
// On ne purge donc jamais toute la table, seulement les lignes qu'on a semees ici.
const TEST_CODES = ["test-platform-alpha", "test-platform-beta"];
const TEST_EMAIL = "platforms-route@test.com";

async function buildApp() {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  registerErrorHandler(app);
  await registerSwagger(app);
  await registerJwt(app);
  await app.register(platformsRoutes, { prefix: "/api" });
  await app.ready();
  return app;
}

async function cleanup() {
  await db.delete(platforms).where(inArray(platforms.code, TEST_CODES));
  await db.delete(users).where(eq(users.email, TEST_EMAIL));
}

async function seedUser() {
  const [u] = await db
    .insert(users)
    .values({
      email: TEST_EMAIL,
      username: "platroute",
      passwordHash: "x",
    })
    .returning({ id: users.id });
  return u.id;
}

beforeEach(cleanup);

describe("GET /api/platforms", () => {
  it("renvoie 401 sans JWT", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/platforms" });
    expect(res.statusCode).toBe(401);
  });

  it("renvoie 200 et la liste triee par nom", async () => {
    const app = await buildApp();
    const userId = await seedUser();
    // Insere volontairement dans le desordre pour verifier le tri par name.
    await db.insert(platforms).values([
      { name: "Zzz Test Platform Beta", code: "test-platform-beta", iconUrl: null },
      {
        name: "Aaa Test Platform Alpha",
        code: "test-platform-alpha",
        iconUrl: "https://example.com/pc.png",
      },
    ]);
    const token = app.jwt.sign({ sub: userId });
    const res = await app.inject({
      method: "GET",
      url: "/api/platforms",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      items: { id: string; name: string; code: string; iconUrl: string | null }[];
    };
    const names = body.items.map((p) => p.name);
    const alphaIndex = names.indexOf("Aaa Test Platform Alpha");
    const betaIndex = names.indexOf("Zzz Test Platform Beta");
    // Les deux lignes semees doivent apparaitre, dans l'ordre alphabetique.
    expect(alphaIndex).toBeGreaterThanOrEqual(0);
    expect(betaIndex).toBeGreaterThan(alphaIndex);

    const alpha = body.items[alphaIndex];
    expect(alpha.code).toBe("test-platform-alpha");
    expect(alpha.iconUrl).toBe("https://example.com/pc.png");
    expect(typeof alpha.id).toBe("string");

    const beta = body.items[betaIndex];
    expect(beta.code).toBe("test-platform-beta");
    expect(beta.iconUrl).toBeNull();
  });
});

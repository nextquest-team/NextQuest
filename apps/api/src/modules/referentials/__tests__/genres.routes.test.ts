import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import { db, genres, users } from "@nextquest/db";
import { eq, inArray } from "drizzle-orm";
import { validatorCompiler, serializerCompiler } from "fastify-type-provider-zod";
import { registerJwt } from "../../../plugins/jwt.js";
import { registerErrorHandler } from "../../../lib/error-handler.js";
import { registerSwagger } from "../../../plugins/swagger.js";
import { genresRoutes } from "../genres.routes.js";

// Slugs dedies a ce test : "genres" est un referentiel partage (les 23 genres
// IGDB semes par la migration 0013 sont deja presents). On ne purge donc jamais
// toute la table, seulement les lignes qu'on a semees ici.
const TEST_SLUGS = ["test-genre-zeta", "test-genre-alpha"];
const TEST_EMAIL = "genres-route@test.com";

async function buildApp() {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);
  await registerSwagger(app);
  await registerJwt(app);
  await app.register(genresRoutes, { prefix: "/api" });
  await app.ready();
  return app;
}

async function cleanup() {
  await db.delete(genres).where(inArray(genres.slug, TEST_SLUGS));
  await db.delete(users).where(eq(users.email, TEST_EMAIL));
}

async function seedUser() {
  const [u] = await db
    .insert(users)
    .values({ email: TEST_EMAIL, username: "genroute", passwordHash: "x" })
    .returning({ id: users.id });
  return u.id;
}

beforeEach(cleanup);

describe("GET /api/genres", () => {
  it("renvoie 401 sans JWT", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/genres" });
    expect(res.statusCode).toBe(401);
  });

  it("renvoie 200, expose igdbId, respecte l'ordre relatif du tri par nom", async () => {
    const app = await buildApp();
    const userId = await seedUser();
    await db.insert(genres).values([
      { name: "Zeta Genre", slug: "test-genre-zeta", igdbId: 9001 },
      { name: "Alpha Genre", slug: "test-genre-alpha", igdbId: null },
    ]);
    const token = app.jwt.sign({ sub: userId });
    const res = await app.inject({
      method: "GET",
      url: "/api/genres",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const { items } = res.json() as {
      items: { id: string; igdbId: number | null; name: string; slug: string }[];
    };
    // Base de test partagee : le seed de la migration 0013 n'est pas garanti present
    // (d'autres suites purgent la table genres sans le restaurer). On n'asserte donc
    // que sur des donnees maitrisees par ce test, jamais sur le contenu global de la
    // table ni sur une egalite de tri global (la collation Postgres peut differer de
    // localeCompare des qu'il reste des lignes parasites d'autres suites).
    const alpha = items.find((i) => i.slug === "test-genre-alpha");
    const zeta = items.find((i) => i.slug === "test-genre-zeta");
    expect(alpha).toBeDefined();
    expect(zeta).toBeDefined();
    expect(alpha?.igdbId).toBeNull();
    expect(zeta?.igdbId).toBe(9001);
    // orderBy(name) en SQL garantit cet ordre relatif quel que soit l'etat du reste
    // de la table ("Alpha Genre" < "Zeta Genre" alphabetiquement).
    expect(items.indexOf(alpha!)).toBeLessThan(items.indexOf(zeta!));
    for (const item of items) {
      expect(typeof item.id).toBe("string");
      expect(typeof item.name).toBe("string");
      expect(typeof item.slug).toBe("string");
      expect(item.igdbId === null || typeof item.igdbId === "number").toBe(true);
    }
  });
});

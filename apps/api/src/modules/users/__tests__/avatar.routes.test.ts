import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { validatorCompiler, serializerCompiler } from "fastify-type-provider-zod";
import { db, users } from "@nextquest/db";
import { registerJwt } from "../../../plugins/jwt.js";
import { registerErrorHandler } from "../../../lib/error-handler.js";
import { registerSwagger } from "../../../plugins/swagger.js";
import { registerRateLimit } from "../../../plugins/rate-limit.js";

vi.mock("../../../lib/storage.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/storage.js")>();
  return {
    ...actual,
    putAvatar: vi.fn(async (userId: string) => `http://s3.local/avatars/${userId}.webp?v=42`),
    deleteAvatar: vi.fn(async () => undefined),
  };
});

import { putAvatar, deleteAvatar, StorageError } from "../../../lib/storage.js";
import { avatarRoutes } from "../avatar.routes.js";

async function buildApp() {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);
  await registerSwagger(app);
  await registerJwt(app);
  await app.register(avatarRoutes, { prefix: "/api" });
  await app.ready();
  return app;
}

async function createTestUser() {
  const [user] = await db
    .insert(users)
    .values({
      email: `avr-${Date.now()}-${Math.random()}@test.com`,
      username: `avr${Date.now()}${Math.floor(Math.random() * 1000)}`,
      passwordHash: "argon2id$dummy",
    })
    .returning();
  return user;
}

function getToken(app: Awaited<ReturnType<typeof buildApp>>, userId: string) {
  return app.jwt.sign({ sub: userId, role: "user" }, { expiresIn: "15m" });
}

// Corps multipart construit a la main : pas de dependance de test en plus.
function multipartPayload(content: Buffer, filename = "avatar.png", type = "image/png") {
  const boundary = "----vitestboundary42";
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${type}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, content, tail]),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}

async function makePng(): Promise<Buffer> {
  return sharp({
    create: { width: 300, height: 200, channels: 3, background: { r: 0, g: 100, b: 255 } },
  })
    .png()
    .toBuffer();
}

beforeEach(async () => {
  vi.clearAllMocks();
  await db.delete(users);
});

describe("POST /api/users/me/avatar", () => {
  it("401 sans token", async () => {
    const app = await buildApp();
    const { payload, headers } = multipartPayload(await makePng());
    const res = await app.inject({ method: "POST", url: "/api/users/me/avatar", payload, headers });
    expect(res.statusCode).toBe(401);
  });

  it("400 sans fichier", async () => {
    const app = await buildApp();
    const user = await createTestUser();
    const boundary = "----vitestboundary42";
    const res = await app.inject({
      method: "POST",
      url: "/api/users/me/avatar",
      headers: {
        authorization: `Bearer ${getToken(app, user.id)}`,
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload: Buffer.from(`--${boundary}--\r\n`),
    });
    expect(res.statusCode).toBe(400);
  });

  it("200 : upload valide, avatar_url mis a jour en BDD", async () => {
    const app = await buildApp();
    const user = await createTestUser();
    const { payload, headers } = multipartPayload(await makePng());
    const res = await app.inject({
      method: "POST",
      url: "/api/users/me/avatar",
      headers: { ...headers, authorization: `Bearer ${getToken(app, user.id)}` },
      payload,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().avatarUrl).toBe(`http://s3.local/avatars/${user.id}.webp?v=42`);
    expect(putAvatar).toHaveBeenCalledOnce();
    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row.avatarUrl).toBe(`http://s3.local/avatars/${user.id}.webp?v=42`);
  });

  it("400 : contenu qui n'est pas une image", async () => {
    const app = await buildApp();
    const user = await createTestUser();
    const { payload, headers } = multipartPayload(Buffer.from("<html>pas une image</html>"));
    const res = await app.inject({
      method: "POST",
      url: "/api/users/me/avatar",
      headers: { ...headers, authorization: `Bearer ${getToken(app, user.id)}` },
      payload,
    });
    expect(res.statusCode).toBe(400);
    expect(putAvatar).not.toHaveBeenCalled();
  });

  it("413 : fichier au-dela de 5 Mo", async () => {
    const app = await buildApp();
    const user = await createTestUser();
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(6 * 1024 * 1024)]);
    const { payload, headers } = multipartPayload(big, "big.jpg", "image/jpeg");
    const res = await app.inject({
      method: "POST",
      url: "/api/users/me/avatar",
      headers: { ...headers, authorization: `Bearer ${getToken(app, user.id)}` },
      payload,
    });
    expect(res.statusCode).toBe(413);
  });

  it("503 : stockage indisponible", async () => {
    const app = await buildApp();
    const user = await createTestUser();
    vi.mocked(putAvatar).mockRejectedValueOnce(new StorageError("minio down"));
    const { payload, headers } = multipartPayload(await makePng());
    const res = await app.inject({
      method: "POST",
      url: "/api/users/me/avatar",
      headers: { ...headers, authorization: `Bearer ${getToken(app, user.id)}` },
      payload,
    });
    expect(res.statusCode).toBe(503);
  });
});

// Suite dediee au rate limit de la route (config.rateLimit sur la route,
// cf. avatar.routes.ts). Instance d'app SEPAREE avec le plugin rate-limit
// enregistre : les autres describe ci-dessus n'en ont pas besoin et doivent
// rester libres de toute limite pour ne pas devenir flaky.
async function buildAppWithRateLimit() {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);
  await registerSwagger(app);
  await registerJwt(app);
  await registerRateLimit(app);
  await app.register(avatarRoutes, { prefix: "/api" });
  await app.ready();
  return app;
}

describe("POST /api/users/me/avatar — rate limit dedie", () => {
  it("bloque la 11e requete en 429 (limite 10/heure)", async () => {
    const app = await buildAppWithRateLimit();
    const user = await createTestUser();
    const token = getToken(app, user.id);

    // Le keyGenerator par defaut de @fastify/rate-limit indexe par req.ip.
    // Le store est en memoire et scope a CETTE instance d'app (fraiche a
    // chaque appel de buildAppWithRateLimit), donc pas de pollution
    // inter-tests en soi ; on fixe quand meme une IP dediee et aleatoire
    // pour rendre le test deterministe si jamais le fichier est relance
    // dans le meme process (watch mode) sans recreer l'app.
    const remoteAddress = `10.42.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

    let lastRes: Awaited<ReturnType<typeof app.inject>> | undefined;
    for (let i = 0; i < 11; i++) {
      const { payload, headers } = multipartPayload(await makePng());
      lastRes = await app.inject({
        method: "POST",
        url: "/api/users/me/avatar",
        headers: { ...headers, authorization: `Bearer ${token}` },
        payload,
        remoteAddress,
      });
      if (i < 10) {
        expect(lastRes.statusCode).toBe(200);
      }
    }
    expect(lastRes!.statusCode).toBe(429);
  });
});

describe("DELETE /api/users/me/avatar", () => {
  it("204 : supprime l'objet et remet avatar_url a null, idempotent", async () => {
    const app = await buildApp();
    const user = await createTestUser();
    const token = getToken(app, user.id);

    const res = await app.inject({
      method: "DELETE",
      url: "/api/users/me/avatar",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(204);
    expect(deleteAvatar).toHaveBeenCalledWith(user.id);
    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row.avatarUrl).toBeNull();

    const again = await app.inject({
      method: "DELETE",
      url: "/api/users/me/avatar",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(again.statusCode).toBe(204);
  });

  it("401 sans token", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "DELETE", url: "/api/users/me/avatar" });
    expect(res.statusCode).toBe(401);
  });

  it("503 : stockage indisponible, avatar_url intact", async () => {
    const app = await buildApp();
    const user = await createTestUser();
    const existingUrl = "http://s3.local/avatars/existant.webp?v=1";
    await db.update(users).set({ avatarUrl: existingUrl }).where(eq(users.id, user.id));
    vi.mocked(deleteAvatar).mockRejectedValueOnce(new StorageError("minio down"));

    const res = await app.inject({
      method: "DELETE",
      url: "/api/users/me/avatar",
      headers: { authorization: `Bearer ${getToken(app, user.id)}` },
    });

    expect(res.statusCode).toBe(503);
    // L'objet n'a pas ete supprime : l'URL ne doit pas etre passee a null
    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row.avatarUrl).toBe(existingUrl);
  });
});

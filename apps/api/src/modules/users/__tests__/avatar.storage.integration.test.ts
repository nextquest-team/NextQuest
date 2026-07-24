import { describe, it, expect, afterAll } from "vitest";
import sharp from "sharp";
import {
  ensureBucket,
  putAvatar,
  deleteAvatar,
  purgeUserStorage,
} from "../../../lib/storage.js";

// Integration reelle contre MinIO (dev). En CI, S3_ENDPOINT n'existe pas :
// la suite est sautee, la chaine reste couverte par les tests mockes.
const HAS_S3 = Boolean(process.env.S3_ENDPOINT);
const TEST_USER = `it-storage-${Date.now()}`;

describe.skipIf(!HAS_S3)("stockage avatars — MinIO reel", () => {
  afterAll(async () => {
    if (HAS_S3) await purgeUserStorage(TEST_USER);
  });

  it("cree le bucket si besoin", async () => {
    await expect(ensureBucket()).resolves.toBeUndefined();
  });

  it("upload puis lecture publique de l'objet", async () => {
    const webp = await sharp({
      create: { width: 512, height: 512, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .webp()
      .toBuffer();

    const url = await putAvatar(TEST_USER, webp);
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.equals(webp)).toBe(true);
  });

  it("la suppression rend l'objet inaccessible", async () => {
    const webp = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .webp()
      .toBuffer();
    const url = await putAvatar(TEST_USER, webp);
    await deleteAvatar(TEST_USER);
    const res = await fetch(url);
    expect([403, 404]).toContain(res.status);
  });
});

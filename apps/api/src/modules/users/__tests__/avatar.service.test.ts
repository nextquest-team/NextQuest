import { describe, it, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";
import { db, users } from "@nextquest/db";
import { eq } from "drizzle-orm";

vi.mock("../../../lib/storage.js", () => ({
  putAvatar: vi.fn(async (userId: string) => `http://s3.local/avatars/${userId}.webp?v=1`),
  deleteAvatar: vi.fn(async () => undefined),
}));

import { putAvatar, deleteAvatar } from "../../../lib/storage.js";
import {
  detectImageFormat,
  processAvatarImage,
  uploadUserAvatar,
  removeUserAvatar,
  InvalidImageError,
} from "../avatar.service.js";

// Petite image reelle generee par sharp : le pipeline decode du vrai contenu.
async function makePng(width = 800, height = 600): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 100, b: 0 } },
  })
    .png()
    .toBuffer();
}

async function createTestUser() {
  const [user] = await db
    .insert(users)
    .values({
      email: `av-${Date.now()}-${Math.random()}@test.com`,
      username: `av${Date.now()}${Math.floor(Math.random() * 1000)}`,
      passwordHash: "argon2id$dummy",
      avatarUrl: "https://old.example.com/a.png",
    })
    .returning();
  return user;
}

beforeEach(async () => {
  vi.clearAllMocks();
  await db.delete(users);
});

describe("detectImageFormat", () => {
  it("reconnait jpeg, png et webp par magic bytes", async () => {
    expect(detectImageFormat(await makePng())).toBe("png");
    expect(detectImageFormat(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toBe("jpeg");
    const webp = await sharp({
      create: { width: 4, height: 4, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .webp()
      .toBuffer();
    expect(detectImageFormat(webp)).toBe("webp");
  });

  it("rejette le reste (mimetype declare = pas une preuve)", () => {
    expect(detectImageFormat(Buffer.from("GIF89a..."))).toBeNull();
    expect(detectImageFormat(Buffer.from("<script>alert(1)</script>"))).toBeNull();
    expect(detectImageFormat(Buffer.alloc(0))).toBeNull();
  });
});

describe("processAvatarImage", () => {
  it("re-encode en WebP 512x512 quel que soit le ratio d'entree", async () => {
    const out = await processAvatarImage(await makePng(800, 600));
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(512);
    expect(meta.height).toBe(512);
  });

  it("rejette un format non supporte", async () => {
    await expect(processAvatarImage(Buffer.from("pas une image"))).rejects.toBeInstanceOf(
      InvalidImageError,
    );
  });

  it("rejette une image aux magic bytes valides mais corrompue", async () => {
    const fake = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(64, 7)]);
    await expect(processAvatarImage(fake)).rejects.toBeInstanceOf(InvalidImageError);
  });
});

describe("uploadUserAvatar", () => {
  it("stocke l'image traitee et met a jour avatar_url", async () => {
    const user = await createTestUser();
    const dto = await uploadUserAvatar(user.id, await makePng());

    expect(putAvatar).toHaveBeenCalledOnce();
    const [calledUserId, calledBuffer] = vi.mocked(putAvatar).mock.calls[0];
    expect(calledUserId).toBe(user.id);
    expect((await sharp(calledBuffer).metadata()).format).toBe("webp");

    expect(dto.avatarUrl).toBe(`http://s3.local/avatars/${user.id}.webp?v=1`);
    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row.avatarUrl).toBe(`http://s3.local/avatars/${user.id}.webp?v=1`);
  });

  it("ne touche pas au bucket si l'image est invalide", async () => {
    const user = await createTestUser();
    await expect(uploadUserAvatar(user.id, Buffer.from("junk"))).rejects.toBeInstanceOf(
      InvalidImageError,
    );
    expect(putAvatar).not.toHaveBeenCalled();
  });
});

describe("removeUserAvatar", () => {
  it("supprime l'objet et remet avatar_url a null", async () => {
    const user = await createTestUser();
    await removeUserAvatar(user.id);
    expect(deleteAvatar).toHaveBeenCalledWith(user.id);
    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row.avatarUrl).toBeNull();
  });
});

import sharp from "sharp";
import { db, users } from "@nextquest/db";
import { and, eq, isNull } from "drizzle-orm";
import { toUserDTO, type UserDTO } from "./users.dto.js";
import { putAvatar, deleteAvatar } from "../../lib/storage.js";

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_SIZE = 512;

// Entree utilisateur invalide (format, contenu corrompu) -> 400 cote route,
// a distinguer de StorageError (infra indisponible) -> 503.
export class InvalidImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidImageError";
  }
}

// Detection par magic bytes : le mimetype declare par le client n'est pas
// une preuve. Formats acceptes : jpeg, png, webp.
export function detectImageFormat(buf: Buffer): "jpeg" | "png" | "webp" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "jpeg";
  }
  const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length >= 8 && buf.subarray(0, 8).equals(pngMagic)) {
    return "png";
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

// Re-encodage systematique : resize 512x512 crop centre + WebP. Les pixels
// servis sortent de sharp, jamais du fichier d'origine -- ca neutralise tout
// payload malveillant deguise en image.
export async function processAvatarImage(input: Buffer): Promise<Buffer> {
  if (!detectImageFormat(input)) {
    throw new InvalidImageError("Format d'image non supporte (jpeg, png ou webp attendu)");
  }
  try {
    return await sharp(input)
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover" })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    // Magic bytes plausibles mais contenu indecodable.
    throw new InvalidImageError("Image illisible ou corrompue");
  }
}

export async function uploadUserAvatar(userId: string, file: Buffer): Promise<UserDTO> {
  const processed = await processAvatarImage(file);
  const url = await putAvatar(userId, processed);
  const [updated] = await db
    .update(users)
    .set({ avatarUrl: url, updatedAt: new Date() })
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .returning();
  if (!updated) {
    throw new Error(`User ${userId} introuvable ou soft-deleted`);
  }
  return toUserDTO(updated);
}

export async function removeUserAvatar(userId: string): Promise<void> {
  // L'objet d'abord, la BDD ensuite : si la suppression S3 echoue on garde
  // l'URL en base (etat coherent), l'utilisateur peut re-essayer.
  await deleteAvatar(userId);
  await db
    .update(users)
    .set({ avatarUrl: null, updatedAt: new Date() })
    .where(and(eq(users.id, userId), isNull(users.deletedAt)));
}

import sharp from "sharp";
import { putDefaultAvatar } from "../../lib/storage.js";

const AVATAR_SIZE = 512;
const BACKGROUND_COLOR = "#5C3317";
const TEXT_COLOR = "#EDC78E";

// Premiere lettre alphanumerique du nom (Unicode : accents, autres alphabets),
// repliee sur "?" si le nom n'en contient aucune -- evite d'injecter un
// caractere arbitraire (espace, emoji, ponctuation) dans le SVG genere.
export function getAvatarInitial(name: string): string {
  const match = name.trim().match(/[\p{L}\p{N}]/u);
  return (match?.[0] ?? "?").toUpperCase();
}

function buildAvatarSvg(initial: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${AVATAR_SIZE}" height="${AVATAR_SIZE}">
  <rect width="100%" height="100%" fill="${BACKGROUND_COLOR}"/>
  <text x="50%" y="52%" font-family="Georgia, 'Times New Roman', serif" font-size="${Math.round(AVATAR_SIZE * 0.45)}" font-weight="bold" fill="${TEXT_COLOR}" text-anchor="middle" dominant-baseline="central">${initial}</text>
</svg>`;
}

// Avatar de repli genere a la creation du compte (et re-genere quand
// l'utilisateur supprime sa photo) : avatar_url pointe toujours vers une
// image reelle, coherente entre web et mobile, plutot que de laisser chaque
// client reimplementer son propre rendu de repli (initiale, couleur...).
export async function generateDefaultAvatar(userId: string, name: string): Promise<string> {
  const initial = getAvatarInitial(name);
  const svg = buildAvatarSvg(initial);
  const buffer = await sharp(Buffer.from(svg)).webp({ quality: 90 }).toBuffer();
  return putDefaultAvatar(userId, buffer);
}

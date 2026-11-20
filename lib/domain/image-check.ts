/** Confere o tipo real do arquivo pelos primeiros bytes (não confia no nome/extensão). */
export type ImageMime = "image/jpeg" | "image/png" | "image/webp";

export function sniffImage(bytes: Uint8Array): ImageMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return "image/png";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return "image/webp";
  return null;
}

export const MAX_IDENTITY_FILE_BYTES = 1_500_000;
export const IDENTITY_KINDS = ["doc_front", "doc_back", "selfie"] as const;
export type IdentityKind = (typeof IDENTITY_KINDS)[number];
export const MAX_IDENTITY_ATTEMPTS = 3;

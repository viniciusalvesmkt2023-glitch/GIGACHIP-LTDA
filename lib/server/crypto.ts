import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

/**
 * Criptografia de campos sensíveis (CPF, IMEI, EID, ICCID) — AES-256-GCM.
 * Formato: [versão 1 byte][iv 12 bytes][tag 16 bytes][texto cifrado].
 * A chave vem de variável de ambiente e nunca é gravada no banco.
 */

const VERSION = 1;
const IV_LEN = 12;
const TAG_LEN = 16;

function decodeKey(base64: string, name: string): Buffer {
  const key = Buffer.from(base64, "base64");
  if (key.length !== 32) throw new Error(`${name} deve ter 32 bytes em base64`);
  return key;
}

export function encryptField(plain: string, keyBase64: string): Buffer {
  const key = decodeKey(keyBase64, "FIELD_ENCRYPTION_KEY");
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptField(blob: Uint8Array, keyBase64: string): string {
  const key = decodeKey(keyBase64, "FIELD_ENCRYPTION_KEY");
  const buf = Buffer.from(blob);
  if (buf[0] !== VERSION) throw new Error("versão de criptografia desconhecida");
  const iv = buf.subarray(1, 1 + IV_LEN);
  const tag = buf.subarray(1 + IV_LEN, 1 + IV_LEN + TAG_LEN);
  const data = buf.subarray(1 + IV_LEN + TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** HMAC-SHA256 do CPF (só dígitos) — permite buscar/deduplicar sem descriptografar. */
export function cpfHash(cpfDigits: string, keyBase64: string): string {
  const key = decodeKey(keyBase64, "CPF_HASH_KEY");
  return createHmac("sha256", key).update(cpfDigits).digest("hex");
}

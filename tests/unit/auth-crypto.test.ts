import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  hashPassword,
  passwordProblem,
  totpCode,
  verifyPassword,
  verifyTotp,
} from "@/lib/server/auth-crypto";

describe("senhas", () => {
  it("confere a senha certa e recusa a errada", async () => {
    const h = await hashPassword("SenhaForte2026!");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("SenhaForte2026!", h)).toBe(true);
    expect(await verifyPassword("SenhaForte2026?", h)).toBe(false);
    expect(await verifyPassword("qualquer", null)).toBe(false);
  });
  it("exige senha forte", () => {
    expect(passwordProblem("curta1")).toMatch(/12 caracteres/);
    expect(passwordProblem("somenteletrasmuitolongas")).toMatch(/letras e números/);
    expect(passwordProblem("letrasEnumeros2026")).toBeNull();
  });
});

describe("2FA (TOTP)", () => {
  // Vetores da RFC 6238 (SHA1), segredo ASCII "12345678901234567890" (últimos 6 dígitos)
  const secret = base32Encode(Buffer.from("12345678901234567890"));
  it("base32 ida e volta", () => {
    expect(secret).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(base32Decode(secret).toString()).toBe("12345678901234567890");
  });
  it("bate com os vetores da RFC 6238", () => {
    expect(totpCode(secret, 59_000)).toBe("287082");
    expect(totpCode(secret, 1_111_111_109_000)).toBe("081804");
    expect(totpCode(secret, 2_000_000_000_000)).toBe("279037");
  });
  it("aceita janela de ±30 s e recusa códigos errados", () => {
    const now = 1_111_111_109_000;
    expect(verifyTotp(secret, totpCode(secret, now - 30_000), now)).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, now - 90_000), now)).toBe(false);
    expect(verifyTotp(secret, "12345", now)).toBe(false);
    expect(verifyTotp(secret, "abcdef", now)).toBe(false);
  });
});

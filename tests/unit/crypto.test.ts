import { describe, expect, it } from "vitest";
import { cpfHash, decodeKey, decryptField, encryptField } from "@/lib/server/crypto";

const senha = "SenhaForteGeradaPeloGerador1234567890abc";
const base64 = Buffer.alloc(32, 7).toString("base64");

describe("criptografia de campos", () => {
  it("cifra e decifra com senha comum ou com base64", () => {
    for (const key of [senha, base64]) {
      const blob = encryptField("52998224725", key);
      expect(blob.toString("utf8")).not.toContain("52998224725");
      expect(decryptField(blob, key)).toBe("52998224725");
    }
  });
  it("cada cifragem é diferente (IV aleatório)", () => {
    expect(encryptField("x", senha).equals(encryptField("x", senha))).toBe(false);
  });
  it("chave errada não decifra", () => {
    const blob = encryptField("52998224725", senha);
    expect(() => decryptField(blob, senha + "x")).toThrow();
  });
  it("rejeita senha curta", () => {
    expect(() => decodeKey("curta", "X")).toThrow(/32 caracteres/);
  });
  it("hash do CPF é estável e depende da chave", () => {
    expect(cpfHash("52998224725", senha)).toBe(cpfHash("52998224725", senha));
    expect(cpfHash("52998224725", senha)).not.toBe(cpfHash("52998224725", base64));
  });
});

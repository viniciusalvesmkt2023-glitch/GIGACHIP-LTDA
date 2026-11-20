import { describe, expect, it } from "vitest";
import {
  checkEid,
  checkIccid,
  formatCpf,
  isValidCpf,
  isValidImei,
  luhnIsValid,
  maskCpf,
  normalizeBrMobile,
} from "@/lib/domain/validators";

/** Completa um número com o dígito Luhn correto (para gerar casos de teste). */
function withLuhn(partial: string): string {
  for (let d = 0; d <= 9; d++) if (luhnIsValid(partial + d)) return partial + d;
  throw new Error("impossível");
}

/** Gera um EID válido a partir de 30 dígitos (ISO 7064 mod 97-10). */
function withEidCheck(first30: string): string {
  const rem = BigInt(first30 + "00") % BigInt(97);
  const check = BigInt(98) - rem;
  return first30 + check.toString().padStart(2, "0");
}

describe("CPF", () => {
  it("aceita CPF válido com ou sem máscara", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
  });
  it("rejeita dígito errado, tamanho errado e sequências repetidas", () => {
    expect(isValidCpf("529.982.247-26")).toBe(false);
    expect(isValidCpf("5299822472")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("")).toBe(false);
  });
  it("formata e mascara", () => {
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(maskCpf("52998224725")).toBe("***.982.247-**");
    expect(maskCpf("123")).toBe("***.***.***-**");
  });
});

describe("IMEI", () => {
  it("aceita IMEI com Luhn válido", () => {
    expect(isValidImei("490154203237518")).toBe(true);
    expect(isValidImei("49-015420-323751-8")).toBe(true);
  });
  it("rejeita dígito errado e tamanho errado", () => {
    expect(isValidImei("490154203237519")).toBe(false);
    expect(isValidImei("49015420323751")).toBe(false);
  });
});

describe("ICCID", () => {
  it("aceita 19 e 20 dígitos começando com 89", () => {
    const iccid19 = withLuhn("895510000000000001");
    const iccid20 = withLuhn("8955100000000000001");
    expect(checkIccid(iccid19)).toEqual({ ok: true, checksumOk: true });
    expect(checkIccid(iccid20)).toEqual({ ok: true, checksumOk: true });
  });
  it("formato ok mas dígito errado vira só aviso", () => {
    const good = withLuhn("895510000000000001");
    const bad = good.slice(0, -1) + ((Number(good.at(-1)) + 1) % 10);
    expect(checkIccid(bad)).toEqual({ ok: true, checksumOk: false });
  });
  it("bloqueia formato inválido", () => {
    expect(checkIccid("12345").ok).toBe(false);
    expect(checkIccid("7955100000000000001").ok).toBe(false);
  });
});

describe("EID", () => {
  const valid = withEidCheck("890490321234512345123456789012");
  it("aceita EID com dígitos verificadores corretos", () => {
    expect(valid).toHaveLength(32);
    expect(checkEid(valid)).toEqual({ ok: true, checksumOk: true });
  });
  it("dígito errado vira aviso", () => {
    const bad = valid.slice(0, -1) + ((Number(valid.at(-1)) + 1) % 10);
    expect(checkEid(bad)).toEqual({ ok: true, checksumOk: false });
  });
  it("bloqueia tamanho errado", () => {
    expect(checkEid("8904903212345").ok).toBe(false);
  });
});

describe("celular", () => {
  it("normaliza para E.164", () => {
    expect(normalizeBrMobile("(88) 99999-1556")).toBe("+5588999991556");
    expect(normalizeBrMobile("+55 88 99999-1556")).toBe("+5588999991556");
  });
  it("rejeita fixo e DDD inválido", () => {
    expect(normalizeBrMobile("(88) 3333-1556")).toBeNull();
    expect(normalizeBrMobile("(08) 99999-1556")).toBeNull();
  });
});

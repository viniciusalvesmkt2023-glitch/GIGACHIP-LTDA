import { describe, expect, it } from "vitest";
import {
  colorToRgb,
  DEFAULT_RULES,
  eventForLine,
  isProtectedColumn,
  parseRules,
  ruleColumnIndex,
  ruleConditionMatches,
  ruleTextForSheet,
  type SheetRule,
} from "@/lib/domain/planilha-regras";

const regra = (p: Partial<SheetRule>): SheetRule => ({
  quando: "ativar", coluna: "Gestor", escrever: "Gestor Ativo", corTexto: null, corFundo: null, seValor: null, ...p,
});

describe("regras da planilha", () => {
  it("de fábrica: ao ativar, Gestor vira “Gestor Ativo”", () => {
    expect(DEFAULT_RULES.find((r) => r.quando === "ativar" && r.coluna === "Gestor")?.escrever).toBe("Gestor Ativo");
    expect(parseRules(DEFAULT_RULES).rules).toEqual(DEFAULT_RULES);
  });

  it("dono troca o texto para “Ativo”", () => {
    const { rules, errors } = parseRules([{ quando: "ativar", coluna: " Gestor ", escrever: "Ativo" }]);
    expect(errors).toEqual([]);
    expect(rules).toEqual([regra({ escrever: "Ativo" })]);
  });

  it("ignora linha em branco e recusa coluna Número, regra sem ação e momento inválido", () => {
    const { rules, errors } = parseRules([
      { quando: "ativar", coluna: "", escrever: "" },
      { quando: "ativar", coluna: "Número", escrever: "x" },
      { quando: "ativar", coluna: "Gestor" },
      { quando: "sempre", coluna: "Gestor", escrever: "x" },
      { quando: "bloquear", coluna: "Cliente", corTexto: "vermelho", corFundo: "rosa" },
    ]);
    expect(rules).toEqual([regra({ quando: "bloquear", coluna: "Cliente", escrever: null, corTexto: "vermelho" })]);
    expect(errors).toHaveLength(3);
    expect(errors[0]).toMatch(/Ao ativar a linha, coluna “Número”: essa coluna não pode/);
  });

  it("acha a coluna sem ligar para maiúsculas e acentos", () => {
    expect(ruleColumnIndex(["Cliente", "Número", "GESTOR"], "gestor")).toBe(2);
    expect(ruleColumnIndex(["Ativação"], "ativacao")).toBe(0);
    expect(ruleColumnIndex(["Cliente"], "Gestor")).toBe(-1);
    // cabeçalho escrito diferente, mas reconhecido pelo sistema: usa a mesma coluna
    expect(ruleColumnIndex(["Nome do Cliente", "Número"], "Cliente", { cliente: 0, numero: 1 })).toBe(0);
    expect(ruleColumnIndex(["Nome do Cliente", "Número"], "Gestor", { cliente: 0, numero: 1 })).toBe(-1);
    expect(isProtectedColumn("Nº Número")).toBe(true);
    expect(isProtectedColumn("Gestor")).toBe(false);
  });

  it("condição: só troca se o valor atual for um dos listados", () => {
    const r = regra({ seValor: "Falta Bloquear Gestor; Gestor Bloqueio" });
    expect(ruleConditionMatches(r, "falta bloquear gestor")).toBe(true);
    expect(ruleConditionMatches(r, "Gestor Bloqueio")).toBe(true);
    expect(ruleConditionMatches(r, "Cancelado")).toBe(false);
    expect(ruleConditionMatches(regra({}), "qualquer coisa")).toBe(true);
  });

  it("texto nunca vira fórmula e cor vai no formato do Google", () => {
    expect(ruleTextForSheet("=IMPORTXML()")).toBe("'=IMPORTXML()");
    expect(ruleTextForSheet("Gestor Ativo")).toBe("Gestor Ativo");
    expect(colorToRgb("vermelho")).toEqual({ red: 0.8, green: 0, blue: 0 });
    expect(colorToRgb("branco")).toEqual({ red: 1, green: 1, blue: 1 });
  });

  it("descobre o momento pela situação da linha", () => {
    const base = { orderId: "o1", overwrite: false, activatedAt: "2026-11-20T10:00:00Z", reactivatedAt: null };
    expect(eventForLine({ ...base, status: "ativa" })).toBe("ativar");
    expect(eventForLine({ ...base, status: "suspensa" })).toBe("bloquear");
    expect(eventForLine({ ...base, status: "ativa", reactivatedAt: "2026-12-25T10:00:00Z" })).toBe("desbloquear");
    // revendida depois de um desbloqueio antigo
    expect(eventForLine({ ...base, status: "ativa", reactivatedAt: "2026-01-01T10:00:00Z" })).toBe("ativar");
    // correção no painel não aplica regras
    expect(eventForLine({ ...base, status: "ativa", overwrite: true })).toBe(null);
    // linha antiga (sem pedido) desbloqueada
    expect(eventForLine({ ...base, orderId: null, activatedAt: null, status: "ativa", reactivatedAt: "2026-12-25T10:00:00Z" })).toBe("desbloquear");
    expect(eventForLine({ ...base, orderId: null, status: "ativa" })).toBe(null);
  });
});

describe("nome do cliente na planilha", async () => {
  const { sameCustomerName } = await import("@/lib/domain/inadimplencia");
  it("aceita nome mais curto escrito à mão e recusa outro cliente", () => {
    expect(sameCustomerName("Filipe Santos", "Filipe Santos da Silva")).toBe(true);
    expect(sameCustomerName("FILIPE SANTOS", "Filipe Santos")).toBe(true);
    expect(sameCustomerName("Filipe", "Filipe Santos")).toBe(false);
    expect(sameCustomerName("Filipe Souza", "Filipe Santos")).toBe(false);
    expect(sameCustomerName("Ana Santos", "Filipe Santos")).toBe(false);
  });
});

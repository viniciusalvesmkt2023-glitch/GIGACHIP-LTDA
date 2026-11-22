import { describe, expect, it } from "vitest";
import {
  DEFAULT_TEMPLATES,
  EXAMPLE_CONTEXT as ctx,
  effectiveTemplates,
  expectedClientText,
  parseTemplates,
  renderTemplate,
  unknownTags,
} from "@/lib/domain/planilha-modelos";

describe("o que escrever em cada coluna", () => {
  it("de fábrica sai igual ao de sempre (data de verdade, R$ e ICCID como texto)", () => {
    const r = (f: keyof typeof DEFAULT_TEMPLATES) => renderTemplate(DEFAULT_TEMPLATES[f]!, ctx, "pt_BR");
    expect(r("cliente")).toBe("Beatriz Rocha");
    expect(r("iccid")).toBe("'89551093000000000012");
    expect(r("ativacao")).toBe("20/11/2026");
    expect(r("venda")).toBe("R$ 149,99");
    expect(r("valor")).toBe("R$ 32,50");
    expect(r("vencimento")).toBe("20/12/2026");
  });

  it("monta textos com várias etiquetas (maiúsculas e acentos não importam)", () => {
    expect(renderTemplate("[Nome do cliente] - pedido [Número do pedido]", ctx, "pt_BR")).toBe("Beatriz Rocha - pedido 8");
    expect(renderTemplate("[primeiro nome] ([plano do site])", ctx, "pt_BR")).toBe("Beatriz (Plano 200GB)");
    expect(renderTemplate("Todo dia [Dia do vencimento]", ctx, "pt_BR")).toBe("Todo dia 20");
    expect(renderTemplate("ICCID [ICCID]", ctx, "pt_BR")).toBe("ICCID 89551093000000000012");
    expect(renderTemplate("[numero do pedido]", { ...ctx, pedido: null }, "pt_BR")).toBe("");
  });

  it("nunca vira fórmula e etiqueta desconhecida fica como está", () => {
    expect(renderTemplate("=[Nome do cliente]", ctx, "pt_BR")).toBe("'=Beatriz Rocha");
    expect(renderTemplate("[Nome]", ctx, "pt_BR")).toBe("[Nome]");
    expect(unknownTags("[Nome] e [ICCID]")).toEqual(["Nome"]);
  });

  it("valida: Cliente precisa do nome; etiqueta errada é avisada; vazio = não escreve", () => {
    expect(parseTemplates({ cliente: "Cliente novo" }).errors[0]).toMatch(/Cliente: precisa/);
    expect(parseTemplates({ venda: "[Valor venda]" }).errors[0]).toMatch(/não conheço \[Valor venda\]/);
    const ok = parseTemplates({ cliente: " [Nome do cliente]  #[Número do pedido] ", iccid: "", xyz: "a" });
    expect(ok.errors).toEqual([]);
    expect(ok.templates).toEqual({ cliente: "[Nome do cliente] #[Número do pedido]", iccid: "" });
    expect(effectiveTemplates(ok.templates).iccid).toBe("");
    expect(effectiveTemplates(ok.templates).venda).toBe("[Venda final]");
  });

  it("conferência do dono da linha usa o modelo do Cliente", () => {
    expect(expectedClientText("[Nome do cliente] - [Número do pedido]", ctx, "pt_BR")).toBe("Beatriz Rocha - 8");
    expect(expectedClientText(undefined, ctx, "pt_BR")).toBe("Beatriz Rocha");
  });
});

import { describe, expect, it } from "vitest";
import { parseCheckoutForm } from "@/lib/domain/checkout-input";

const today = new Date("2026-11-20T12:00:00Z");
const valid = {
  planSlug: "vivo-300gb",
  fullName: "Maria da Silva",
  cpf: "529.982.247-25",
  birthDate: "1990-05-10",
  email: "Maria@Exemplo.com ",
  phone: "(88) 99999-1556",
  simType: "esim",
  billingType: "pix",
  acceptTerms: "on",
  acceptPrivacy: "on",
};

describe("formulário de contratação", () => {
  it("normaliza os campos válidos", () => {
    const r = parseCheckoutForm(valid, today);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.cpf).toBe("52998224725");
    expect(r.value.email).toBe("maria@exemplo.com");
    expect(r.value.phone).toBe("+5588999991556");
    expect(r.value.whatsappOptIn).toBe(false);
  });

  it("aponta cada campo inválido com mensagem em português", () => {
    const r = parseCheckoutForm(
      { ...valid, cpf: "111.111.111-11", fullName: "Maria", phone: "123", acceptTerms: undefined },
      today,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.cpf).toBe("CPF inválido.");
    expect(r.errors.fullName).toBe("Informe nome e sobrenome.");
    expect(r.errors.phone).toMatch(/Celular inválido/);
    expect(r.errors.acceptTerms).toMatch(/aceitar os termos/);
  });

  it("exige maioridade", () => {
    const r = parseCheckoutForm({ ...valid, birthDate: "2010-01-01" }, today);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.birthDate).toMatch(/18 anos/);
  });

  it("rejeita campos desconhecidos (proteção contra envio forjado)", () => {
    const r = parseCheckoutForm({ ...valid, status: "ativado" }, today);
    expect(r.ok).toBe(false);
  });

  it("só aceita os tipos previstos", () => {
    const r = parseCheckoutForm({ ...valid, simType: "satelite", billingType: "boleto" }, today);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.simType).toBeDefined();
      expect(r.errors.billingType).toBeDefined();
    }
  });
});

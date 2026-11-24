import { describe, expect, it } from "vitest";
import { buildContract, CONTRACT_TEMPLATE_VERSION, type ContractData } from "@/lib/contract/template";
import { totalMensalCents, WATCH_TV, watchFromQuery } from "@/lib/domain/watch-tv";

describe("Watch TV (D44)", () => {
  it("custa R$ 50 por mês e permite 4 TVs", () => {
    expect(WATCH_TV.precoCents).toBe(5000);
    expect(WATCH_TV.telas).toBe(4);
    expect(WATCH_TV.resumo).toContain("IPTV legalizado");
  });

  it("soma na mensalidade só enquanto não for cancelada", () => {
    expect(totalMensalCents(14999, null)).toBe(14999);
    expect(totalMensalCents(14999, 5000, "pendente")).toBe(19999);
    expect(totalMensalCents(14999, 5000, "ativo")).toBe(19999);
    expect(totalMensalCents(14999, 5000, "cancelado")).toBe(14999);
  });

  it("só vem marcada do cartão do plano com ?tv=1", () => {
    expect(watchFromQuery("1")).toBe(true);
    expect(watchFromQuery(["1"])).toBe(true);
    expect(watchFromQuery(undefined)).toBe(false);
    expect(watchFromQuery("sim")).toBe(false);
  });

  const data: ContractData = {
    orderCode: "#9",
    customer: { fullName: "Maria da Silva", cpf: "52998224725", birthDate: "1990-05-10", email: "maria@exemplo.com", phone: "+5588999991556" },
    plan: { name: "Plano 300GB", baseGb: 200, bonusGb: 100, totalGb: 300, monthlyPriceCents: 14999 },
    simType: "esim",
    billingType: "pix",
    dueDay: 20,
  };
  const settings = {
    version: CONTRACT_TEMPLATE_VERSION, isTest: false, whatsapp: null, supportEmail: "contato@gigachip.com.br",
    unblockTime: "24 (vinte e quatro) horas", blockedDaysBeforeCancel: 5,
  };

  it("o contrato só fala da Watch TV para quem levou", () => {
    const sem = buildContract(data, settings).map((b) => b.text).join("\n");
    expect(sem).not.toContain("Watch TV");
    const com = buildContract({ ...data, watchTvCents: 5000 }, settings).map((b) => b.text).join("\n");
    expect(com).toContain("2.1.1.");
    expect(com).toContain("**Watch TV**");
    expect(com).toContain("**R$ 50,00**");
    expect(com).toContain("total de **R$ 199,99**");
    expect(com).toContain("cancelada separadamente");
  });
});

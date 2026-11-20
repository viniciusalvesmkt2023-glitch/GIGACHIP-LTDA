import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderContractPdf } from "@/lib/contract/pdf";
import { buildContract, CONTRACT_TEMPLATE_VERSION, type ContractData, type ContractSettings } from "@/lib/contract/template";

const data: ContractData = {
  orderCode: "GC-2026-00123",
  customer: { fullName: "Maria da Silva Exemplo", cpf: "52998224725", birthDate: "1990-05-10", email: "maria@exemplo.com", phone: "+5588999991556" },
  plan: { name: "Plano 300GB", baseGb: 200, bonusGb: 100, totalGb: 300, monthlyPriceCents: 14999 },
  simType: "esim",
  billingType: "pix",
  dueDay: 20,
};
const settings: ContractSettings = {
  version: CONTRACT_TEMPLATE_VERSION,
  isTest: true,
  whatsapp: null,
  privacyUrl: "https://gigachip-ltda.vercel.app/privacidade",
  dpoEmail: null,
  unblockTime: null,
  cancelAfterDays: null,
  adjustmentRule: null,
};

describe("contrato", () => {
  const text = buildContract(data, settings).map((b) => b.text).join("\n");

  it("preenche os dados do pedido, cliente e plano", () => {
    expect(text).toContain("GC-2026-00123");
    expect(text).toContain("CPF 529.982.247-25");
    expect(text).toContain("10/05/1990");
    expect(text).toContain("(88) 99999-1556");
    expect(text).toContain("**300GB**");
    expect(text).toContain("R$ 149,99");
    expect(text).toContain("todo dia **20**");
    expect(text).toContain("**eSIM**");
    expect(text).not.toMatch(/\{\{|undefined|null/);
  });

  it("é feito para assinatura eletrônica (sem linha de assinatura nem 'local e data')", () => {
    expect(text).toContain("assinado **eletronicamente** pela plataforma D4Sign");
    expect(text).not.toMatch(/_{5,}/);
    expect(text).not.toMatch(/local e data/i);
  });

  it("marca o que ainda precisa ser decidido", () => {
    expect(text).toContain("[A DEFINIR: prazo de desbloqueio]");
    const done = buildContract(data, { ...settings, whatsapp: "(88) 90000-0000", unblockTime: "24 (vinte e quatro) horas", cancelAfterDays: 30, adjustmentRule: "anualmente, pelo IPCA", dpoEmail: "privacidade@gigachip.com.br" })
      .map((b) => b.text).join("\n");
    expect(done).not.toContain("[A DEFINIR");
  });

  it("chip físico e cartão mudam o texto", () => {
    const t = buildContract({ ...data, simType: "physical", billingType: "credit_card" }, settings).map((b) => b.text).join("\n");
    expect(t).toContain("chip físico lacrado adquirido pelo CLIENTE");
    expect(t).toContain("**cartão de crédito**");
  });

  it("gera um PDF válido", async () => {
    const pdf = await renderContractPdf(buildContract(data, settings), { orderCode: data.orderCode, isTest: true });
    expect(Buffer.from(pdf.bytes.slice(0, 5)).toString()).toBe("%PDF-");
    expect(pdf.pages).toBeGreaterThanOrEqual(2);
    expect(pdf.sha256).toMatch(/^[0-9a-f]{64}$/);
    if (process.env.CONTRACT_SAMPLE_OUT) writeFileSync(process.env.CONTRACT_SAMPLE_OUT, pdf.bytes);
  });
});

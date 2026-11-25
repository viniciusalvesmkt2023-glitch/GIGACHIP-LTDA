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
  supportEmail: "contato@gigachip.com.br",
  unblockTime: "24 (vinte e quatro) horas",
  blockedDaysBeforeCancel: 5,
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
    expect(text).toContain("assinado **eletronicamente** pelo CLIENTE na plataforma Clicksign");
    // contratos antigos (D4Sign) citam a D4Sign
    const antigo = buildContract(data, { ...settings, platform: "D4Sign" }).map((b) => b.text).join("\n");
    expect(antigo).toContain("na plataforma D4Sign");
    expect(text).not.toMatch(/_{5,}/);
    expect(text).not.toMatch(/local e data/i);
  });

  it("aplica as decisões dos sócios (D10, D19)", () => {
    expect(text).not.toContain("[A DEFINIR");
    expect(text).toContain("desbloqueada em até 24 (vinte e quatro) horas");
    expect(text).toContain("bloqueada por 5 (cinco) dias sem pagamento, o contrato será cancelado");
    expect(text).toContain("IPCA/IBGE");
    expect(text).toContain("poderá cancelar sem multa");
    expect(text).toContain("contato@gigachip.com.br");
    expect(text).toContain("assinado **eletronicamente** pelo CLIENTE");
  });

  it("sem WhatsApp usa só o e-mail; com WhatsApp mostra os dois", () => {
    expect(text).toContain("Atendimento: e-mail contato@gigachip.com.br.");
    const comWa = buildContract(data, { ...settings, whatsapp: "(88) 90000-0000" }).map((b) => b.text).join("\n");
    expect(comWa).toContain("e-mail contato@gigachip.com.br e WhatsApp (88) 90000-0000");
  });

  it("versão aprovada: sem cláusula de dados pessoais, cláusulas numeradas de 1 a 8", () => {
    const titulos = buildContract(data, settings).filter((b) => b.type === "heading").map((b) => b.text);
    expect(titulos.map((t) => t.split(".")[0])).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
    expect(text).not.toMatch(/LGPD|Política de Privacidade|privacidade/i);
    expect(text).toContain("7.2. Por ser contratação fora do estabelecimento");
    expect(text).toContain("8.2. Fica eleito o foro");
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

describe("WhatsApp de atendimento", () => {
  it("formata número com 8 ou 9 dígitos", async () => {
    const { formatWhatsapp } = await import("@/lib/contract/settings");
    expect(formatWhatsapp("55 85 8129-0832")).toBe("(85) 8129-0832");
    expect(formatWhatsapp("5588999991556")).toBe("(88) 99999-1556");
    expect(formatWhatsapp("123")).toBeNull();
  });

  it("o contrato aprovado sai sem a marca de teste e com o WhatsApp padrão", async () => {
    const { contractSettings } = await import("@/lib/contract/settings");
    const old = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
    delete process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
    const s = contractSettings();
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER = old;
    expect(s.isTest).toBe(false);
    expect(s.whatsapp).toBe("(85) 8129-0832");
  });
});

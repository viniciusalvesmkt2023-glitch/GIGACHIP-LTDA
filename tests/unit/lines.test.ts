import { describe, expect, it } from "vitest";
import {
  csvCell,
  formatMsisdn,
  parseMoneyToCents,
  parseMsisdn,
  parseNumbersPaste,
  paymentMethodText,
  smartDadosText,
} from "@/lib/domain/lines";

describe("números de linha", () => {
  it("aceita os formatos da planilha", () => {
    expect(parseMsisdn("11937336662")).toBe("+5511937336662");
    expect(parseMsisdn("(11) 93733-6662")).toBe("+5511937336662");
    expect(parseMsisdn("+55 11 93733-6662")).toBe("+5511937336662");
    expect(parseMsisdn("123")).toBeNull();
  });
  it("formata para exibir", () => {
    expect(formatMsisdn("+5511937336662")).toBe("(11) 93733-6662");
  });
});

describe("colunas da planilha", () => {
  it("Smart-Dados no mesmo formato", () => {
    expect(smartDadosText(100, 100)).toBe("Franquia de 100+100GB");
    expect(smartDadosText(150, 0)).toBe("Franquia de 150GB");
  });
  it("forma de pagamento", () => {
    expect(paymentMethodText("pix")).toBe("PIX Asaas");
    expect(paymentMethodText("credit_card")).toBe("Cartão Asaas");
  });
  it("valores em reais", () => {
    expect(parseMoneyToCents("R$ 30,00")).toBe(3000);
    expect(parseMoneyToCents("30")).toBe(3000);
    expect(parseMoneyToCents("1.234,56")).toBe(123456);
    expect(parseMoneyToCents("abc")).toBeNull();
  });
});

describe("colar números disponíveis", () => {
  it("aceita número sozinho, número;plano e login;número;plano (ou tab da planilha)", () => {
    const r = parseNumbersPaste(
      "11900000001\n11900000002;Internet Móvel 10GB Emp 4G\n471500000\t11900000003\tInternet Móvel 10GB Emp 4G\n11900000001\nlixo",
      "471500000",
    );
    expect(r.rows).toEqual([
      { msisdn: "+5511900000001", vivoLogin: "471500000", planoPj: null },
      { msisdn: "+5511900000002", vivoLogin: "471500000", planoPj: "Internet Móvel 10GB Emp 4G" },
      { msisdn: "+5511900000003", vivoLogin: "471500000", planoPj: "Internet Móvel 10GB Emp 4G" },
    ]);
    expect(r.invalid).toEqual(["lixo"]);
  });
});

describe("exportação CSV", () => {
  it("escapa separador/aspas e bloqueia fórmulas", () => {
    expect(csvCell("Franquia de 100+100GB")).toBe("Franquia de 100+100GB");
    expect(csvCell('a;b"c')).toBe('"a;b""c"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(null)).toBe("");
  });
});

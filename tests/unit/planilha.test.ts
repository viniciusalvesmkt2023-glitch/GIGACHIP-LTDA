import { describe, expect, it } from "vitest";
import {
  columnLetter,
  isAvailableMarker,
  findHeader,
  formatForSheet,
  mapHeader,
  parseSheetDate,
  parseSheetRows,
  quoteTab,
  spreadsheetIdFromUrl,
} from "@/lib/domain/planilha";

const HEADER = ["Cliente Ativos", "Loguin Vivo Gestão", "Número", "ICCID Atual", "Smart-Dados", "Plano PJ", "Ativação", "Venda Final", "Valor", "Próximo Vencimento", "Forma de Pagamento"];

describe("mapHeader", () => {
  it("acha as colunas pelo nome, com ou sem acento", () => {
    expect(mapHeader(HEADER)).toEqual({
      cliente: 0, login: 1, numero: 2, iccid: 3, smart: 4, plano: 5, ativacao: 6, venda: 7, valor: 8, vencimento: 9, pagamento: 10,
    });
  });
  it("funciona com as colunas em outra ordem", () => {
    expect(mapHeader(["Numero", "Valor", "Venda final", "Cliente"])).toEqual({ numero: 0, valor: 1, venda: 2, cliente: 3 });
  });
  it("aceita o vencimento escrito errado ou abreviado", () => {
    for (const h of ["Vencimeto", "Venc.", "Vcto", "Próx. vencto"]) expect(mapHeader(["Número", h])?.vencimento).toBe(1);
  });
  it("sem coluna de número não é cabeçalho", () => {
    expect(mapHeader(["Cliente", "Plano"])).toBeNull();
  });
});

describe("findHeader + parseSheetRows", () => {
  const rows = [
    ["CONTROLE DE LINHAS"],
    [],
    HEADER,
    ["Disponível", "471500000", "11 93733-6662", "", "", "Smart Empresas 6+200GB", "", "", "", "", "PIX Asaas"],
    ["Maria Souza", "471500000", "(11) 93733-6663", "89551093000000000012", "Franquia de 100+100GB", "Smart Empresas", "05/10/2026", "R$ 124,99", "R$ 30,00", "05/12/2026", "Cartão"],
    ["", "", "123", "", "", "", "", "", "", "", ""],
    ["Repetido", "", "11937336662", "", "", "", "", "", "", "", ""],
  ];
  it("acha o cabeçalho abaixo do título", () => {
    expect(findHeader(rows)?.index).toBe(2);
  });
  it("lê disponíveis e clientes; ignora número inválido e repetido", () => {
    const h = findHeader(rows)!;
    const { rows: out, invalid } = parseSheetRows(rows, h);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ rowNumber: 4, msisdn: "+5511937336662", kind: "disponivel", cliente: null, login: "471500000", plano: "Smart Empresas 6+200GB" });
    expect(out[1]).toMatchObject({
      rowNumber: 5, kind: "cliente", cliente: "Maria Souza", iccid: "89551093000000000012", ativacao: "2026-10-05",
      vendaCents: 12499, valorCents: 3000, vencimento: "2026-12-05", pagamento: "Cartão",
    });
    expect(invalid).toEqual([6]);
  });
  it("número repetido fica marcado (o sistema não escreve nele)", () => {
    const { duplicates } = parseSheetRows(rows, findHeader(rows)!);
    expect([...duplicates.entries()]).toEqual([["+5511937336662", [4, 7]]]);
  });
});

describe("número disponível", () => {
  it("'Disponível' (com ou sem acento, maiúsculo) é número livre", () => {
    for (const v of ["Disponível", "DISPONIVEL", " disponível ", "Livre"]) expect(isAvailableMarker(v)).toBe(true);
  });
  it("'Disponível' com dados da venda preenchidos fica fora da lista", () => {
    const rows = [["Cliente", "Número", "ICCID Atual", "Smart-Dados", "Vencimeto"], ["Disponível", "11919908711", "", "Franquia de 100+100GB", "05/12/2026"]];
    const r = parseSheetRows(rows, findHeader(rows)!).rows[0];
    expect(r.kind).toBe("inconsistente");
    expect(r.problem).toBe('está "Disponível" mas tem Smart-Dados, Vencimento preenchido');
  });
  it("Cliente vazio fica fora da lista", () => {
    const rows = [["Cliente", "Número", "ICCID"], ["", "11919908711", ""]];
    expect(parseSheetRows(rows, findHeader(rows)!).rows[0].kind).toBe("inconsistente");
  });
  it("nome de cliente não é número livre", () => {
    expect(isAvailableMarker("Maria Disponível Souza")).toBe(false);
    expect(isAvailableMarker("Cicero Rodrigues")).toBe(false);
  });
  it("na leitura, 'Disponível' vira linha sem cliente", () => {
    const rows = [["Cliente", "Número", "ICCID"], ["Disponível", "11919908711", ""]];
    const r = parseSheetRows(rows, findHeader(rows)!).rows[0];
    expect(r.kind).toBe("disponivel");
    expect(r.cliente).toBeNull();
  });
});

describe("formatação", () => {
  const v = { cliente: "Ana", iccid: "89551093000000000012", smart: "Franquia de 300+100GB", ativacao: "2026-11-21", vendaCents: 17999, valorCents: 3000, vencimento: "2026-12-21" };
  it("planilha em português: data dd/mm/aaaa e R$ com vírgula", () => {
    expect(formatForSheet("ativacao", v, "pt_BR")).toBe("21/11/2026");
    expect(formatForSheet("venda", v, "pt_BR")).toBe("R$ 179,99");
    expect(formatForSheet("valor", v, "pt_BR")).toBe("R$ 30,00");
  });
  it("ICCID vai como texto para não perder dígitos", () => {
    expect(formatForSheet("iccid", v, "pt_BR")).toBe("'89551093000000000012");
  });
  it("datas da planilha", () => {
    expect(parseSheetDate("5/1/27")).toBe("2027-01-05");
    expect(parseSheetDate("31/13/2026")).toBeNull();
  });
  it("colunas e abas", () => {
    expect(columnLetter(0)).toBe("A");
    expect(columnLetter(26)).toBe("AA");
    expect(quoteTab("Linhas d'água")).toBe("'Linhas d''água'");
  });
  it("link da planilha → ID", () => {
    expect(spreadsheetIdFromUrl("https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit#gid=0")).toBe(
      "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789",
    );
    expect(spreadsheetIdFromUrl("não é link")).toBeNull();
  });
});

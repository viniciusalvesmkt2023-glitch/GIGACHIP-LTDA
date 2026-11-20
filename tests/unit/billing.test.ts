import { describe, expect, it } from "vitest";
import {
  dueDateForCycle,
  formatDate,
  lineStatusAfterPayment,
  lineStatusOnOverdue,
  overdueAction,
  parseDate,
  reminderDates,
  todayInSaoPaulo,
} from "@/lib/domain/billing";

const d = parseDate;
const due = (purchase: string, cycle: number) => formatDate(dueDateForCycle(d(purchase), cycle));

describe("vencimento no mesmo dia da compra", () => {
  it("compra dia 20 vence todo dia 20", () => {
    expect(due("2026-11-20", 1)).toBe("2026-12-20");
    expect(due("2026-11-20", 2)).toBe("2027-01-20");
    expect(due("2026-11-20", 12)).toBe("2027-11-20");
  });
  it("compra dia 31 vence no último dia em meses curtos e volta ao 31 depois", () => {
    expect(due("2027-01-31", 1)).toBe("2027-02-28");
    expect(due("2027-01-31", 2)).toBe("2027-03-31");
    expect(due("2027-01-31", 3)).toBe("2027-04-30");
  });
  it("ano bissexto", () => {
    expect(due("2028-01-30", 1)).toBe("2028-02-29");
  });
  it("rejeita ciclo inválido", () => {
    expect(() => dueDateForCycle(d("2026-11-20"), 0)).toThrow();
  });
});

describe("lembretes", () => {
  it("3 dias antes e no dia", () => {
    expect(reminderDates(d("2026-12-20")).map(formatDate)).toEqual(["2026-12-17", "2026-12-20"]);
  });
});

describe("inadimplência (D10)", () => {
  const vencimento = d("2026-12-20");
  const at = (day: string) => overdueAction({ due: vencimento, today: d(day), paid: false });
  it("no dia do vencimento ainda não faz nada", () => {
    expect(at("2026-12-20")).toBe("nenhuma");
  });
  it("não pagou no dia 20 → bloqueia no dia 21 e segue bloqueada até o dia 25", () => {
    expect(at("2026-12-21")).toBe("suspender_linha");
    expect(at("2026-12-25")).toBe("suspender_linha");
  });
  it("5 dias bloqueada sem pagar → cancela no dia 26", () => {
    expect(at("2026-12-26")).toBe("cancelar_linha");
  });
  it("pago nunca bloqueia", () => {
    expect(overdueAction({ due: vencimento, today: d("2027-01-30"), paid: true })).toBe("nenhuma");
  });
  it("prazo configurável e opção de nunca cancelar", () => {
    expect(overdueAction({ due: vencimento, paid: false, today: d("2027-01-18"), cancelAfterDays: 30 })).toBe("suspender_linha");
    expect(overdueAction({ due: vencimento, paid: false, today: d("2027-01-19"), cancelAfterDays: 30 })).toBe("cancelar_linha");
    expect(overdueAction({ due: vencimento, paid: false, today: d("2027-06-01"), cancelAfterDays: null })).toBe("suspender_linha");
  });
});

describe("ciclo da linha", () => {
  it("atraso: ativa → suspensão pendente (equipe bloqueia na Vivo)", () => {
    expect(lineStatusOnOverdue("ativa", "suspender_linha")).toBe("suspensao_pendente");
    expect(lineStatusOnOverdue("suspensa", "suspender_linha")).toBe("suspensa");
  });
  it("pagou antes da equipe bloquear → volta a ativa sozinha", () => {
    expect(lineStatusAfterPayment("suspensao_pendente")).toBe("ativa");
  });
  it("pagou com a linha bloqueada → fila de reativação", () => {
    expect(lineStatusAfterPayment("suspensa")).toBe("reativacao_pendente");
  });
  it("cancelada não volta", () => {
    expect(lineStatusAfterPayment("cancelada")).toBe("cancelada");
    expect(lineStatusOnOverdue("cancelada", "cancelar_linha")).toBe("cancelada");
  });
});

describe("fuso de São Paulo", () => {
  it("02:00 UTC ainda é o dia anterior em São Paulo", () => {
    expect(formatDate(todayInSaoPaulo(new Date("2026-12-21T02:00:00Z")))).toBe("2026-12-20");
  });
});

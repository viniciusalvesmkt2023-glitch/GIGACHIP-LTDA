import { describe, expect, it } from "vitest";
import {
  dueDateForCycle,
  formatDate,
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

describe("inadimplência", () => {
  const vencimento = d("2026-12-20");
  it("no dia do vencimento ainda não faz nada", () => {
    expect(overdueAction({ due: vencimento, today: d("2026-12-20"), paid: false })).toBe("nenhuma");
  });
  it("não pagou no dia 20 → cancelar no dia 21", () => {
    expect(overdueAction({ due: vencimento, today: d("2026-12-21"), paid: false })).toBe("cancelar_linha");
  });
  it("pago nunca cancela", () => {
    expect(overdueAction({ due: vencimento, today: d("2027-01-30"), paid: true })).toBe("nenhuma");
  });
  it("prazo configurável", () => {
    expect(overdueAction({ due: vencimento, today: d("2026-12-22"), paid: false, cancelAfterDays: 3 })).toBe("nenhuma");
    expect(overdueAction({ due: vencimento, today: d("2026-12-23"), paid: false, cancelAfterDays: 3 })).toBe("cancelar_linha");
  });
});

describe("fuso de São Paulo", () => {
  it("02:00 UTC ainda é o dia anterior em São Paulo", () => {
    expect(formatDate(todayInSaoPaulo(new Date("2026-12-21T02:00:00Z")))).toBe("2026-12-20");
  });
});

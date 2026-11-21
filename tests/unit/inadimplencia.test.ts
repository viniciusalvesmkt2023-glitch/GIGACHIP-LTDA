import { describe, expect, it } from "vitest";
import { parseDate } from "@/lib/domain/billing";
import { customerSituation, daysLate, normalizeName, overdueStateFromAsaas } from "@/lib/domain/inadimplencia";

describe("overdueStateFromAsaas", () => {
  it("vencida é atraso em aberto", () => {
    expect(overdueStateFromAsaas("OVERDUE")).toBe("em_aberto");
    expect(overdueStateFromAsaas("DUNNING_REQUESTED")).toBe("em_aberto");
  });
  it("paga (PIX, cartão, dinheiro) sai do atraso como paga", () => {
    for (const s of ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "DUNNING_RECEIVED"]) expect(overdueStateFromAsaas(s)).toBe("pago");
  });
  it("removida, estornada ou com vencimento alterado não é mais atraso", () => {
    expect(overdueStateFromAsaas("OVERDUE", true)).toBe("sem_atraso");
    expect(overdueStateFromAsaas("PENDING")).toBe("sem_atraso");
    expect(overdueStateFromAsaas("REFUNDED")).toBe("sem_atraso");
  });
  it("status desconhecido não muda nada", () => {
    expect(overdueStateFromAsaas("ALGO_NOVO")).toBeNull();
  });
});

describe("daysLate", () => {
  it("conta dias corridos desde o vencimento", () => {
    expect(daysLate("2026-11-20", parseDate("2026-11-21"))).toBe(1);
    expect(daysLate("2026-11-20", parseDate("2026-11-26"))).toBe(6);
    expect(daysLate("2026-12-31", parseDate("2027-01-02"))).toBe(2);
  });
  it("nunca é negativo", () => {
    expect(daysLate("2026-11-25", parseDate("2026-11-21"))).toBe(0);
  });
});

describe("customerSituation", () => {
  it("deve e não está bloqueado → bloquear", () => expect(customerSituation(2, false)).toBe("bloquear"));
  it("bloqueado e ainda deve → bloqueado", () => expect(customerSituation(1, true)).toBe("bloqueado"));
  it("bloqueado e pagou tudo → desbloquear", () => expect(customerSituation(0, true)).toBe("desbloquear"));
  it("sem atraso e sem bloqueio → em dia", () => expect(customerSituation(0, false)).toBe("em_dia"));
});

describe("normalizeName", () => {
  it("ignora acentos, maiúsculas e espaços", () => {
    expect(normalizeName("  João  da SILVA ")).toBe(normalizeName("joao da silva"));
  });
});

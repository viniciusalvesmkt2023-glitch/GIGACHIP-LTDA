import { describe, expect, it } from "vitest";
import { earlyTerminationFineCents } from "@/lib/domain/early-termination";
import { formatBRL, formatOrderCode, ORDER_CODE_REGEX } from "@/lib/domain/money";

const activatedAt = new Date("2026-01-01T12:00:00Z");
const after = (days: number) => new Date(activatedAt.getTime() + days * 86_400_000);

describe("multa de cancelamento antecipado", () => {
  it("sem benefício não há multa", () => {
    expect(earlyTerminationFineCents({ activatedAt, cancelledAt: after(10), benefitCents: 0 })).toBe(0);
  });
  it("teto de R$ 50 proporcional aos dias restantes", () => {
    // benefício R$ 100 > teto R$ 50; cancelou no dia 30 → 60 dias restantes → 50 × 60/90 = 33,33
    expect(earlyTerminationFineCents({ activatedAt, cancelledAt: after(30), benefitCents: 10_000 })).toBe(3333);
  });
  it("limitada ao benefício quando o benefício é menor que o teto", () => {
    // benefício R$ 30; dia 0 → 90 restantes → R$ 30
    expect(earlyTerminationFineCents({ activatedAt, cancelledAt: activatedAt, benefitCents: 3000 })).toBe(3000);
  });
  it("após 90 dias não há multa", () => {
    expect(earlyTerminationFineCents({ activatedAt, cancelledAt: after(90), benefitCents: 10_000 })).toBe(0);
    expect(earlyTerminationFineCents({ activatedAt, cancelledAt: after(200), benefitCents: 10_000 })).toBe(0);
  });
});

describe("dinheiro e código do pedido", () => {
  it("formata reais", () => {
    expect(formatBRL(14999)).toBe("R$ 149,99");
  });
  it("código do pedido", () => {
    expect(formatOrderCode(2026, 123)).toBe("GC-2026-00123");
    expect(ORDER_CODE_REGEX.test("GC-2026-00123")).toBe(true);
  });
});

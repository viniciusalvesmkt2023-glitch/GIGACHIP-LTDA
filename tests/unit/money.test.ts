import { describe, expect, it } from "vitest";
import { formatBRL, formatOrderCode, ORDER_CODE_REGEX } from "@/lib/domain/money";

describe("dinheiro e código do pedido", () => {
  it("formata reais", () => {
    expect(formatBRL(14999)).toBe("R$ 149,99");
  });
  it("código do pedido", () => {
    expect(formatOrderCode(2026, 123)).toBe("GC-2026-00123");
    expect(ORDER_CODE_REGEX.test("GC-2026-00123")).toBe(true);
  });
});

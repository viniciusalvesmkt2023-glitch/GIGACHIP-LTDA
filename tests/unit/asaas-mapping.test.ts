import { describe, expect, it } from "vitest";
import {
  centsToReais,
  isValidWebhookToken,
  mapAsaasPaymentStatus,
  reaisToCents,
  statusFromEvent,
} from "@/lib/integrations/asaas/mapping";

describe("status do Asaas", () => {
  it.each([
    ["PENDING", "pending"],
    ["AWAITING_RISK_ANALYSIS", "pending"],
    ["CONFIRMED", "confirmed"],
    ["RECEIVED", "received"],
    ["OVERDUE", "overdue"],
    ["REFUNDED", "refunded"],
    ["REFUND_REQUESTED", "refunded"],
    ["CHARGEBACK_REQUESTED", "chargeback"],
  ])("%s → %s", (asaas, nosso) => {
    expect(mapAsaasPaymentStatus(asaas)).toBe(nosso);
  });
  it("status desconhecido não muda nada", () => {
    expect(mapAsaasPaymentStatus("ALGO_NOVO")).toBeNull();
  });
  it("cobrança removida vira cancelada", () => {
    expect(statusFromEvent("PAYMENT_DELETED", "PENDING")).toBe("cancelled");
    expect(statusFromEvent("PAYMENT_RECEIVED", "RECEIVED")).toBe("received");
  });
});

describe("token do webhook", () => {
  const token = "x".repeat(40);
  it("aceita token igual", () => {
    expect(isValidWebhookToken(token, token)).toBe(true);
  });
  it("rejeita ausente, diferente ou de tamanho diferente", () => {
    expect(isValidWebhookToken(null, token)).toBe(false);
    expect(isValidWebhookToken("y".repeat(40), token)).toBe(false);
    expect(isValidWebhookToken("x".repeat(39), token)).toBe(false);
  });
});

describe("conversão de valores", () => {
  it("centavos ↔ reais sem erro de arredondamento", () => {
    expect(centsToReais(14999)).toBe(149.99);
    expect(reaisToCents(149.99)).toBe(14999);
    expect(reaisToCents(0.1 + 0.2)).toBe(30);
  });
});

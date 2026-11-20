/**
 * Regras puras da integração com o Asaas (sem rede, testáveis).
 * Documentação: https://docs.asaas.com
 */
import { timingSafeEqual } from "node:crypto";
import type { PaymentStatus } from "@/lib/domain/order-status";

export type AsaasBillingType = "PIX" | "CREDIT_CARD" | "BOLETO" | "UNDEFINED";

/** Status de cobrança do Asaas → nosso status. Status desconhecido → null (não muda nada). */
export function mapAsaasPaymentStatus(status: string): PaymentStatus | null {
  switch (status) {
    case "PENDING":
    case "AWAITING_RISK_ANALYSIS":
      return "pending";
    case "CONFIRMED":
      return "confirmed";
    case "RECEIVED":
    case "RECEIVED_IN_CASH":
    case "DUNNING_RECEIVED":
      return "received";
    case "OVERDUE":
    case "DUNNING_REQUESTED":
      return "overdue";
    // Estorno solicitado já bloqueia a ativação (conservador)
    case "REFUNDED":
    case "REFUND_REQUESTED":
    case "REFUND_IN_PROGRESS":
      return "refunded";
    case "CHARGEBACK_REQUESTED":
    case "CHARGEBACK_DISPUTE":
    case "AWAITING_CHARGEBACK_REVERSAL":
      return "chargeback";
    default:
      return null;
  }
}

/** Eventos de webhook que interessam ao fluxo de cobrança. */
export function isPaymentEvent(event: string): boolean {
  return event.startsWith("PAYMENT_");
}

/** Pagamento removido no Asaas (PAYMENT_DELETED) → cobrança cancelada. */
export function statusFromEvent(event: string, apiStatus: string): PaymentStatus | null {
  if (event === "PAYMENT_DELETED") return "cancelled";
  return mapAsaasPaymentStatus(apiStatus);
}

/**
 * O Asaas autentica o webhook com um token fixo no header `asaas-access-token`
 * (não é assinatura). Comparação em tempo constante.
 */
export function isValidWebhookToken(received: string | null, expected: string): boolean {
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const centsToReais = (cents: number): number => Math.round(cents) / 100;
export const reaisToCents = (value: number): number => Math.round(value * 100);

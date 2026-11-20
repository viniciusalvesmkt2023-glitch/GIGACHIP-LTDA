/**
 * Máquina de estados do pedido (docs/05-estados-do-pedido.md).
 * Esta é a fonte da verdade em TypeScript; o banco aplica as mesmas regras
 * em supabase/migrations (função gc_order_is_ready e trigger de transição).
 */

export const ORDER_STATUSES = [
  "rascunho",
  "aguardando_pagamento",
  "em_andamento",
  "pronto_para_ativacao",
  "em_ativacao",
  "ativado",
  "pendencia",
  "expirado",
  "cancelado",
  "cancelado_reembolso",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "pending",
  "confirmed",
  "received",
  "overdue",
  "refunded",
  "chargeback",
  "cancelled",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const IDENTITY_STATUSES = [
  "not_started",
  "pending_documents",
  "in_review",
  "approved",
  "rejected",
  "retry_required",
] as const;
export type IdentityStatus = (typeof IDENTITY_STATUSES)[number];

export const CONTRACT_STATUSES = [
  "not_created",
  "queued",
  "sent",
  "signed",
  "refused",
  "cancelled",
  "error",
] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const DEVICE_STATUSES = ["pending", "submitted", "confirmed", "invalid"] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

export type ActorType = "system" | "customer" | "staff" | "webhook";

/** Transições permitidas e quem pode fazê-las. */
const TRANSITIONS: Record<OrderStatus, Partial<Record<OrderStatus, ActorType[]>>> = {
  rascunho: {
    aguardando_pagamento: ["system"],
    cancelado: ["customer", "staff"],
  },
  aguardando_pagamento: {
    em_andamento: ["system", "webhook"],
    expirado: ["system"],
    cancelado: ["customer", "staff"],
  },
  em_andamento: {
    pronto_para_ativacao: ["system"],
    pendencia: ["system", "staff", "webhook"],
    cancelado_reembolso: ["staff"],
  },
  pronto_para_ativacao: {
    em_ativacao: ["staff"],
    pendencia: ["system", "staff", "webhook"],
    cancelado_reembolso: ["staff"],
  },
  em_ativacao: {
    pronto_para_ativacao: ["staff"],
    ativado: ["staff"],
    pendencia: ["staff", "webhook"],
  },
  pendencia: {
    em_andamento: ["staff"],
    cancelado_reembolso: ["staff"],
  },
  ativado: {},
  expirado: {},
  cancelado: {},
  cancelado_reembolso: {},
};

export function canTransition(from: OrderStatus, to: OrderStatus, actor: ActorType): boolean {
  return TRANSITIONS[from][to]?.includes(actor) ?? false;
}

export function isFinal(status: OrderStatus): boolean {
  return Object.keys(TRANSITIONS[status]).length === 0;
}

export type Checklist = {
  paymentStatus: PaymentStatus;
  identityStatus: IdentityStatus;
  contractStatus: ContractStatus;
  deviceStatus: DeviceStatus;
};

export const isPaid = (s: PaymentStatus): boolean => s === "confirmed" || s === "received";

/** Regra do "pronto para ativação" (doc 05, regra 1). */
export function isChecklistComplete(c: Checklist): boolean {
  return (
    isPaid(c.paymentStatus) &&
    c.identityStatus === "approved" &&
    c.contractStatus === "signed" &&
    c.deviceStatus === "confirmed"
  );
}

/** D21: o contrato é enviado assim que o pagamento é confirmado (a identidade é conferida em paralelo). */
export function canCreateContract(c: Checklist): boolean {
  return isPaid(c.paymentStatus) && c.contractStatus === "not_created";
}

export type PendingReason =
  | "identidade_recusada"
  | "contrato_erro"
  | "contrato_recusado"
  | "pagamento_estornado";

/** Situações que jogam o pedido para "pendencia" automaticamente (doc 05, regra 5). */
export function automaticPendingReason(
  c: Checklist,
  identityAttempts: number,
  maxIdentityAttempts = 3,
): PendingReason | null {
  if (c.paymentStatus === "refunded" || c.paymentStatus === "chargeback") return "pagamento_estornado";
  if (c.identityStatus === "rejected" && identityAttempts >= maxIdentityAttempts) return "identidade_recusada";
  if (c.contractStatus === "error") return "contrato_erro";
  if (c.contractStatus === "refused") return "contrato_recusado";
  return null;
}

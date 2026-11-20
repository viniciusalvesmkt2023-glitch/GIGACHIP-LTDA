import { describe, expect, it } from "vitest";
import {
  automaticPendingReason,
  canCreateContract,
  canTransition,
  isChecklistComplete,
  isFinal,
  type Checklist,
} from "@/lib/domain/order-status";

const complete: Checklist = {
  paymentStatus: "confirmed",
  identityStatus: "approved",
  contractStatus: "signed",
  deviceStatus: "confirmed",
};

describe("checklist / pronto para ativação", () => {
  it("fica pronto só com as 4 etapas concluídas", () => {
    expect(isChecklistComplete(complete)).toBe(true);
    expect(isChecklistComplete({ ...complete, paymentStatus: "received" })).toBe(true);
  });
  it.each([
    { paymentStatus: "pending" },
    { identityStatus: "in_review" },
    { contractStatus: "sent" },
    { deviceStatus: "submitted" },
  ] as Partial<Checklist>[])("não fica pronto com %o", (override) => {
    expect(isChecklistComplete({ ...complete, ...override })).toBe(false);
  });
});

describe("contrato", () => {
  it("só é criado após pagamento e identidade aprovada", () => {
    const base: Checklist = { ...complete, contractStatus: "not_created", deviceStatus: "pending" };
    expect(canCreateContract(base)).toBe(true);
    expect(canCreateContract({ ...base, identityStatus: "in_review" })).toBe(false);
    expect(canCreateContract({ ...base, paymentStatus: "pending" })).toBe(false);
    expect(canCreateContract({ ...base, contractStatus: "sent" })).toBe(false);
  });
});

describe("transições", () => {
  it("pagamento só é confirmado pelo sistema/webhook, nunca pelo cliente", () => {
    expect(canTransition("aguardando_pagamento", "em_andamento", "webhook")).toBe(true);
    expect(canTransition("aguardando_pagamento", "em_andamento", "customer")).toBe(false);
  });
  it("pronto para ativação é automático", () => {
    expect(canTransition("em_andamento", "pronto_para_ativacao", "system")).toBe(true);
    expect(canTransition("em_andamento", "pronto_para_ativacao", "staff")).toBe(false);
  });
  it("só a equipe ativa", () => {
    expect(canTransition("pronto_para_ativacao", "em_ativacao", "staff")).toBe(true);
    expect(canTransition("em_ativacao", "ativado", "staff")).toBe(true);
    expect(canTransition("em_ativacao", "ativado", "system")).toBe(false);
    expect(canTransition("em_andamento", "ativado", "staff")).toBe(false);
  });
  it("estados finais não saem do lugar", () => {
    expect(isFinal("ativado")).toBe(true);
    expect(isFinal("cancelado_reembolso")).toBe(true);
    expect(canTransition("ativado", "pendencia", "staff")).toBe(false);
  });
});

describe("pendência automática", () => {
  it("estorno ou chargeback", () => {
    expect(automaticPendingReason({ ...complete, paymentStatus: "chargeback" }, 0)).toBe("pagamento_estornado");
  });
  it("identidade recusada só após o limite de tentativas", () => {
    const c = { ...complete, identityStatus: "rejected" as const };
    expect(automaticPendingReason(c, 2)).toBeNull();
    expect(automaticPendingReason(c, 3)).toBe("identidade_recusada");
  });
  it("erro ou recusa do contrato", () => {
    expect(automaticPendingReason({ ...complete, contractStatus: "error" }, 0)).toBe("contrato_erro");
    expect(automaticPendingReason({ ...complete, contractStatus: "refused" }, 0)).toBe("contrato_recusado");
  });
});

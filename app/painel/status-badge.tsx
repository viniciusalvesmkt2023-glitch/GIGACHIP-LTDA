import { STATUS_LABEL } from "@/lib/server/admin";

/** Etiqueta colorida do status do pedido (texto + cor, nunca só cor). */
const TONE: Record<string, string> = {
  pronto_para_ativacao: "blue",
  em_ativacao: "blue",
  em_andamento: "amber",
  aguardando_pagamento: "gray",
  rascunho: "gray",
  ativado: "green",
  pendencia: "red",
  expirado: "muted",
  cancelado: "muted",
  cancelado_reembolso: "muted",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`pd-badge is-${TONE[status] ?? "gray"}`}>{STATUS_LABEL[status] ?? status}</span>;
}

/** Situação da linha (texto + cor, nunca só cor). */
export const LINE_STATUS: Record<string, { label: string; tone: string }> = {
  ativa: { label: "Ativa", tone: "green" },
  disponivel: { label: "Disponível", tone: "blue" },
  suspensao_pendente: { label: "Bloquear na Vivo", tone: "red" },
  suspensa: { label: "Bloqueada", tone: "amber" },
  reativacao_pendente: { label: "Desbloquear na Vivo", tone: "red" },
  cancelamento_pendente: { label: "Cancelar na Vivo", tone: "red" },
  cancelada: { label: "Cancelada", tone: "muted" },
};

export function LineBadge({ status }: { status: string }) {
  const s = LINE_STATUS[status] ?? { label: status, tone: "gray" };
  return <span className={`pd-badge is-${s.tone}`}>{s.label}</span>;
}

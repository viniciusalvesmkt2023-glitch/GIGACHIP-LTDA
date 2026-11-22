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

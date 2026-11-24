/**
 * Watch TV vendida junto com a linha (D44). Oferta opcional, sempre desmarcada: só entra se o
 * cliente marcar (nos planos do site ou no passo de pagamento). Uma cobrança só por mês.
 */
export const WATCH_TV = {
  nome: "Watch TV",
  precoCents: 5000,
  telas: 4,
  resumo: "Canais ao vivo, filmes e séries em até 4 TVs · IPTV legalizado",
} as const;

export type WatchTvStatus = "pendente" | "ativo" | "cancelado";

export const WATCH_TV_STATUS: Record<WatchTvStatus, { label: string; tone: "amber" | "green" | "gray" }> = {
  pendente: { label: "Falta liberar", tone: "amber" },
  ativo: { label: "Liberada", tone: "green" },
  cancelado: { label: "Cancelada", tone: "gray" },
};

/** Mensalidade total do pedido: linha + Watch TV (se levou e não cancelou). */
export function totalMensalCents(linhaCents: number, watchCents: number | null, watchStatus: WatchTvStatus | null = null): number {
  return linhaCents + (watchCents && watchStatus !== "cancelado" ? watchCents : 0);
}

/** Parâmetro da página de planos → formulário ("?tv=1" quando o cliente marcou a caixinha). */
export const watchFromQuery = (v: string | string[] | undefined): boolean => (Array.isArray(v) ? v[0] : v) === "1";

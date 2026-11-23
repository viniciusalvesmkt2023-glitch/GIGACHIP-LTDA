/**
 * Inadimplência (D29) — regras puras.
 *
 * O Asaas marca a cobrança como OVERDUE no dia seguinte ao vencimento. A partir daí o cliente
 * entra na lista "Bloquear linha — sem pagamento". Bloquear e desbloquear são feitos à mão na
 * Vivo; o painel só registra. Quem pagou estando bloqueado vai para "Desbloquear — pagou".
 */
import { compareDates, parseDate, type CalendarDate } from "./billing";

export type OverdueState = "em_aberto" | "pago" | "sem_atraso";

/**
 * Status da cobrança no Asaas → situação na inadimplência.
 * `null` = status desconhecido: não muda nada (conservador).
 */
export function overdueStateFromAsaas(status: string, deleted = false): OverdueState | null {
  if (deleted) return "sem_atraso";
  switch (status) {
    case "OVERDUE":
    case "DUNNING_REQUESTED":
      return "em_aberto";
    case "RECEIVED":
    case "CONFIRMED":
    case "RECEIVED_IN_CASH":
    case "DUNNING_RECEIVED":
      return "pago";
    // Vencimento alterado (voltou a "aguardando"), estornada ou em disputa: não é mais atraso a bloquear
    case "PENDING":
    case "AWAITING_RISK_ANALYSIS":
    case "REFUNDED":
    case "REFUND_REQUESTED":
    case "REFUND_IN_PROGRESS":
    case "CHARGEBACK_REQUESTED":
    case "CHARGEBACK_DISPUTE":
    case "AWAITING_CHARGEBACK_REVERSAL":
      return "sem_atraso";
    default:
      return null;
  }
}

/** Dias corridos entre duas datas de calendário (b − a). */
export function daysBetween(a: CalendarDate, b: CalendarDate): number {
  return Math.round(compareDates(b, a) / 86_400_000);
}

/** Dias de atraso de uma cobrança que venceu em `dueIso` (YYYY-MM-DD). */
export function daysLate(dueIso: string, today: CalendarDate): number {
  return Math.max(0, daysBetween(parseDate(dueIso), today));
}

/**
 * Situação de um cliente na inadimplência a partir das cobranças em aberto e do bloqueio aberto.
 * - tem atraso e não está bloqueado → bloquear
 * - está bloqueado e ainda deve → bloqueado (aguardando pagamento)
 * - está bloqueado e não deve mais → desbloquear
 */
export type CustomerOverdueSituation = "bloquear" | "bloqueado" | "desbloquear" | "em_dia";

export function customerSituation(openOverdueCount: number, hasOpenBlock: boolean): CustomerOverdueSituation {
  if (hasOpenBlock) return openOverdueCount > 0 ? "bloqueado" : "desbloquear";
  return openOverdueCount > 0 ? "bloquear" : "em_dia";
}

/**
 * O nome escrito na planilha é deste cliente? Mesmo primeiro nome e todas as palavras do nome mais
 * curto aparecem no mais longo ("Filipe Santos" × "Filipe Santos da Silva"). Quem confirma é a equipe.
 */
export function sameCustomerName(a: string, b: string): boolean {
  const x = normalizeName(a).split(" ").filter((w) => w.length > 1);
  const y = normalizeName(b).split(" ").filter((w) => w.length > 1);
  if (!x.length || !y.length || x[0] !== y[0]) return false;
  const [curto, longo] = x.length <= y.length ? [x, y] : [y, x];
  return curto.length >= 2 && curto.every((w) => longo.includes(w));
}

/** Nome para comparar com a planilha antiga (sem acentos, minúsculo, espaços simples). */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

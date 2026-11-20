/**
 * Regras de cobrança mensal (docs/07-decisoes.md, D9 e D10).
 *
 * - O vencimento é o mesmo dia da compra, todo mês (compra em 20/11 → vence 20/12, 20/01...).
 * - Em meses sem esse dia (ex.: compra no dia 31), vence no último dia do mês, e volta ao
 *   dia original no mês seguinte que o tiver.
 * - Mensalidade não paga até o fim do dia do vencimento → no dia seguinte a linha entra na
 *   fila de cancelamento (prazo configurável).
 *
 * Datas são tratadas como datas de calendário (sem horário), no fuso de São Paulo.
 */

export type CalendarDate = { year: number; month: number; day: number }; // month: 1–12

export function parseDate(iso: string): CalendarDate {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`data inválida: ${iso}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function formatDate(d: CalendarDate): string {
  return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Data de hoje no fuso de São Paulo. */
export function todayInSaoPaulo(now: Date = new Date()): CalendarDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parseDate(parts);
}

function toUtcMs(d: CalendarDate): number {
  return Date.UTC(d.year, d.month - 1, d.day);
}

export function addDays(d: CalendarDate, days: number): CalendarDate {
  const t = new Date(toUtcMs(d) + days * 86_400_000);
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

export function compareDates(a: CalendarDate, b: CalendarDate): number {
  return toUtcMs(a) - toUtcMs(b);
}

/**
 * Vencimento do ciclo `cycle` (1 = primeiro mês após a compra) para uma compra feita em
 * `purchase`, mantendo o dia da compra como âncora.
 */
export function dueDateForCycle(purchase: CalendarDate, cycle: number): CalendarDate {
  if (!Number.isInteger(cycle) || cycle < 1) throw new Error("ciclo deve ser >= 1");
  const monthIndex = purchase.month - 1 + cycle;
  const year = purchase.year + Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  const day = Math.min(purchase.day, daysInMonth(year, month));
  return { year, month, day };
}

/** Lembretes de pagamento: 3 dias antes e no dia do vencimento. */
export function reminderDates(due: CalendarDate): CalendarDate[] {
  return [addDays(due, -3), due];
}

export const DEFAULT_CANCEL_AFTER_DAYS = 1;

export type OverdueAction = "nenhuma" | "cancelar_linha";

/**
 * O que fazer com uma mensalidade em aberto.
 * cancelAfterDays = 1 → não pagou no dia 20, entra na fila de cancelamento no dia 21.
 */
export function overdueAction(params: {
  due: CalendarDate;
  today: CalendarDate;
  paid: boolean;
  cancelAfterDays?: number;
}): OverdueAction {
  if (params.paid) return "nenhuma";
  const limit = addDays(params.due, params.cancelAfterDays ?? DEFAULT_CANCEL_AFTER_DAYS);
  return compareDates(params.today, limit) >= 0 ? "cancelar_linha" : "nenhuma";
}

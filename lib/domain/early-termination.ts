/**
 * Multa por cancelamento antecipado (cláusula de permanência do contrato).
 *
 * Regra do contrato atual: antes de 90 dias da ativação, multa =
 *   (menor valor entre o teto e o valor do benefício) × dias restantes ÷ 90
 * Sem benefício concedido (valor 0), não há multa. Após 90 dias, não há multa.
 * Valores em centavos, arredondados para baixo (a favor do consumidor).
 */

export const DEFAULT_LOYALTY_DAYS = 90;
export const DEFAULT_FINE_CAP_CENTS = 5000; // R$ 50,00

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Dias corridos entre duas datas (considerando só a data, sem horário, em UTC). */
export function daysBetween(start: Date, end: Date): number {
  const a = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const b = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.floor((b - a) / MS_PER_DAY);
}

export function earlyTerminationFineCents(params: {
  activatedAt: Date;
  cancelledAt: Date;
  benefitCents: number;
  capCents?: number;
  loyaltyDays?: number;
}): number {
  const cap = params.capCents ?? DEFAULT_FINE_CAP_CENTS;
  const loyalty = params.loyaltyDays ?? DEFAULT_LOYALTY_DAYS;
  if (params.benefitCents <= 0) return 0;

  const elapsed = Math.max(0, daysBetween(params.activatedAt, params.cancelledAt));
  const remaining = loyalty - elapsed;
  if (remaining <= 0) return 0;

  const base = Math.min(cap, params.benefitCents);
  return Math.floor((base * remaining) / loyalty);
}

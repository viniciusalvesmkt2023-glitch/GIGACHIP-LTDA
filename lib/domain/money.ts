/** Valores monetários sempre em centavos (inteiro) para evitar erro de arredondamento. */

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(cents: number): string {
  return brl.format(cents / 100).replace(/ /g, " ");
}

/** Código público do pedido: GC-2026-00123 (vai no WhatsApp; não identifica o cliente). */
export function formatOrderCode(year: number, sequence: number): string {
  return `GC-${year}-${String(sequence).padStart(5, "0")}`;
}

export const ORDER_CODE_REGEX = /^GC-\d{4}-\d{5,}$/;

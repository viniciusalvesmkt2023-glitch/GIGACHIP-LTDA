/** Regras puras do estoque de linhas (planilha de controle) — testáveis. */
import { onlyDigits } from "./validators";

/** "11937336662", "(11) 93733-6662" ou "+55 11 93733-6662" → "+5511937336662". null se inválido. */
export function parseMsisdn(input: string): string | null {
  let d = onlyDigits(input);
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (!/^[1-9][1-9]\d{8,9}$/.test(d)) return null;
  return `+55${d}`;
}

/** "+5511937336662" → "(11) 93733-6662" */
export function formatMsisdn(msisdn: string): string {
  const d = msisdn.replace(/^\+55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return msisdn;
}

/** Texto da coluna "Smart-Dados" igual ao da planilha: "Franquia de 100+100GB". */
export function smartDadosText(baseGb: number, bonusGb: number): string {
  return bonusGb > 0 ? `Franquia de ${baseGb}+${bonusGb}GB` : `Franquia de ${baseGb}GB`;
}

export function paymentMethodText(billingType: string | null): string {
  return billingType === "credit_card" ? "Cartão Asaas" : billingType === "pix" ? "PIX Asaas" : "Asaas";
}

/** "R$ 30,00" / "30" / "30,5" → centavos. null se inválido. */
export function parseMoneyToCents(input: string): number | null {
  const clean = input.replace(/[R$\s]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

export type NewNumberRow = { msisdn: string; vivoLogin: string | null; planoPj: string | null };

/**
 * Lê números colados pelo dono (um por linha). Aceita "número", "número;plano PJ" ou
 * "login;número;plano PJ" (separador ; ou tab — colar direto da planilha funciona).
 */
export function parseNumbersPaste(text: string, defaultLogin: string | null): { rows: NewNumberRow[]; invalid: string[] } {
  const rows: NewNumberRow[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/\t|;/).map((p) => p.trim());
    let login = defaultLogin;
    let numberPart: string;
    let plano: string | null = null;
    if (parts.length >= 3) {
      login = parts[0] || defaultLogin;
      numberPart = parts[1];
      plano = parts[2] || null;
    } else {
      numberPart = parts[0];
      plano = parts[1] || null;
    }
    const msisdn = parseMsisdn(numberPart);
    if (!msisdn) {
      invalid.push(line);
      continue;
    }
    if (seen.has(msisdn)) continue;
    seen.add(msisdn);
    rows.push({ msisdn, vivoLogin: login, planoPj: plano });
  }
  return { rows, invalid };
}

/** Uma célula CSV segura para o Excel em português (separador ;). */
export function csvCell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  // Evita que o Excel interprete o conteúdo como fórmula (injeção de CSV)
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

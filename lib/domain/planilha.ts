/**
 * Planilha de controle do gestor (Google Planilhas) — regras puras, testáveis (D30).
 *
 * A planilha continua sendo a do gestor. O sistema:
 *  - LÊ: números novos (sem cliente) viram "disponíveis"; linhas com cliente viram clientes antigos;
 *  - ESCREVE: na ativação preenche Cliente, ICCID, Smart-Dados, Ativação, Venda final, Valor e
 *    Vencimento; no bloqueio pinta o nome de vermelho. Login, Número, Plano PJ e Forma de
 *    pagamento são do gestor e NUNCA são alterados.
 *
 * As colunas são achadas pelo nome do cabeçalho (a ordem pode mudar sem quebrar nada).
 */
import { parseMoneyToCents, parseMsisdn } from "./lines";

export const SHEET_FIELDS = [
  "cliente", "login", "numero", "iccid", "smart", "plano", "ativacao", "venda", "valor", "vencimento", "pagamento",
] as const;
export type SheetField = (typeof SHEET_FIELDS)[number];
export type ColumnMap = Partial<Record<SheetField, number>>;

/** Campos que o sistema escreve na ativação (o resto é do gestor). */
export const WRITABLE_FIELDS: SheetField[] = ["cliente", "iccid", "smart", "ativacao", "venda", "valor", "vencimento"];

export const FIELD_LABEL: Record<SheetField, string> = {
  cliente: "Cliente", login: "Login Vivo", numero: "Número", iccid: "ICCID", smart: "Smart-Dados", plano: "Plano PJ",
  ativacao: "Ativação", venda: "Venda final", valor: "Valor (gestor)", vencimento: "Vencimento", pagamento: "Forma de pagamento",
};

export function normalizeHeader(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function fieldForHeader(h: string): SheetField | null {
  const n = normalizeHeader(h);
  if (!n) return null;
  if (n.includes("numero") || n === "linha" || n === "msisdn") return "numero";
  if (n.includes("cliente")) return "cliente";
  if (n.includes("login") || n.includes("loguin")) return "login";
  if (n.includes("iccid")) return "iccid";
  if (n.includes("smart")) return "smart";
  if (n.includes("plano")) return "plano";
  if (n.includes("ativacao")) return "ativacao";
  if (n.includes("venda")) return "venda";
  // Aceita erros de digitação e abreviações: "Vencimeto", "Venc.", "Vcto", "Vencto"
  if (n.includes("venc") || n.includes("vcto")) return "vencimento";
  if (n.includes("pagamento")) return "pagamento";
  if (n.startsWith("valor")) return "valor";
  return null;
}

/** Mapa coluna→campo de uma linha de cabeçalho. Precisa ter pelo menos a coluna Número. */
export function mapHeader(row: string[]): ColumnMap | null {
  const map: ColumnMap = {};
  row.forEach((cell, i) => {
    const f = fieldForHeader(String(cell ?? ""));
    if (f && map[f] === undefined) map[f] = i;
  });
  return map.numero === undefined ? null : map;
}

/** Procura o cabeçalho nas primeiras linhas da aba. */
export function findHeader(rows: string[][], maxScan = 10): { index: number; map: ColumnMap } | null {
  for (let i = 0; i < Math.min(rows.length, maxScan); i++) {
    const map = mapHeader(rows[i] ?? []);
    if (map && Object.keys(map).length >= 3) return { index: i, map };
  }
  return null;
}

/**
 * - disponivel: "Disponível" na coluna Cliente E as colunas da venda vazias (pode vender);
 * - cliente: tem nome de cliente;
 * - inconsistente: "Disponível" mas com dados da venda preenchidos, ou Cliente vazio → fica FORA
 *   da lista de disponíveis e o sistema não escreve nela até alguém arrumar a planilha.
 */
export type SheetRowKind = "disponivel" | "cliente" | "inconsistente";

/** Colunas que precisam estar vazias para o número estar de fato disponível. */
export const SALE_FIELDS: SheetField[] = ["iccid", "smart", "ativacao", "venda", "valor", "vencimento"];

export type SheetRow = {
  rowNumber: number; // 1 = primeira linha da aba (como aparece na planilha)
  msisdn: string;
  kind: SheetRowKind;
  problem: string | null; // por que está inconsistente
  cliente: string | null; // só quando kind = "cliente"
  login: string | null;
  plano: string | null;
  iccid: string | null;
  smart: string | null;
  ativacao: string | null; // YYYY-MM-DD
  vendaCents: number | null;
  valorCents: number | null;
  vencimento: string | null; // YYYY-MM-DD
  pagamento: string | null;
};

const text = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  return s ? s : null;
};

/**
 * Na planilha do gestor, número livre fica com "Disponível" na coluna Cliente (e as colunas da
 * venda vazias). Também aceita variações comuns. Esses números são tratados como SEM cliente.
 */
export function isAvailableMarker(cliente: string | null): boolean {
  if (!cliente) return false;
  return /^(disponive(l|is)|livre|estoque|vago|sem cliente|para venda|a venda)$/.test(normalizeHeader(cliente));
}

/** Classifica a linha da planilha (regra combinada com o dono — ver SheetRowKind). */
export function classifyRow(cliente: string | null, filledSaleFields: SheetField[]): { kind: SheetRowKind; problem: string | null } {
  const filled = filledSaleFields.map((f) => FIELD_LABEL[f]).join(", ");
  if (isAvailableMarker(cliente)) {
    return filledSaleFields.length
      ? { kind: "inconsistente", problem: `está "Disponível" mas tem ${filled} preenchido` }
      : { kind: "disponivel", problem: null };
  }
  if (!cliente) return { kind: "inconsistente", problem: "coluna Cliente vazia (escreva Disponível ou o nome do cliente)" };
  return { kind: "cliente", problem: null };
}

/** "20/11/2026", "20/11/26" ou "2026-11-20" → "2026-11-20". null se não for data. */
export function parseSheetDate(v: string | null): string | null {
  if (!v) return null;
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(v.trim());
  if (m) {
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const [d, mo] = [Number(m[1]), Number(m[2])];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return `${year}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/**
 * Linhas de dados (abaixo do cabeçalho) com número válido. Número repetido: fica em `duplicates`
 * e o sistema NÃO escreve nele (não dá para saber qual das linhas é a certa).
 */
export function parseSheetRows(rows: string[][], header: { index: number; map: ColumnMap }) {
  const out: SheetRow[] = [];
  const invalid: number[] = [];
  const seen = new Map<string, number>(); // número → linha onde apareceu primeiro
  const duplicates = new Map<string, number[]>(); // número repetido → todas as linhas
  const get = (r: string[], f: SheetField) => (header.map[f] === undefined ? null : text(r[header.map[f]!]));
  for (let i = header.index + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const rawNumber = get(r, "numero");
    if (!rawNumber) continue;
    const msisdn = parseMsisdn(rawNumber);
    if (!msisdn) {
      invalid.push(i + 1);
      continue;
    }
    if (seen.has(msisdn)) {
      duplicates.set(msisdn, [...(duplicates.get(msisdn) ?? [seen.get(msisdn)!]), i + 1]);
      continue;
    }
    seen.set(msisdn, i + 1);
    const money = (f: SheetField) => {
      const v = get(r, f);
      return v ? parseMoneyToCents(v) : null;
    };
    const clienteRaw = get(r, "cliente");
    const { kind, problem } = classifyRow(clienteRaw, SALE_FIELDS.filter((f) => get(r, f)));
    out.push({
      rowNumber: i + 1,
      msisdn,
      kind,
      problem,
      cliente: kind === "cliente" ? clienteRaw : null,
      login: get(r, "login"),
      plano: get(r, "plano"),
      iccid: get(r, "iccid")?.replace(/\s/g, "") ?? null,
      smart: get(r, "smart"),
      ativacao: parseSheetDate(get(r, "ativacao")),
      vendaCents: money("venda"),
      valorCents: money("valor"),
      vencimento: parseSheetDate(get(r, "vencimento")),
      pagamento: get(r, "pagamento"),
    });
  }
  return { rows: out, invalid, duplicates };
}

/** 0 → A, 25 → Z, 26 → AA */
export function columnLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Nome da aba entre aspas para usar em intervalos (A1 notation). */
export function quoteTab(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

export type SaleValues = {
  cliente: string;
  iccid: string | null;
  smart: string | null;
  ativacao: string | null; // YYYY-MM-DD
  vendaCents: number | null;
  valorCents: number | null;
  vencimento: string | null; // YYYY-MM-DD
};

/** Valores como a planilha entende (planilha em português: 21/11/2026 e R$ 179,99). */
export function formatForSheet(field: SheetField, v: SaleValues, locale: string): string {
  const pt = locale.toLowerCase().startsWith("pt");
  const date = (iso: string | null) => {
    if (!iso) return "";
    const [y, m, d] = iso.slice(0, 10).split("-");
    return pt ? `${d}/${m}/${y}` : `${y}-${m}-${d}`;
  };
  const money = (c: number | null) => (c === null ? "" : pt ? `R$ ${(c / 100).toFixed(2).replace(".", ",")}` : (c / 100).toFixed(2));
  switch (field) {
    case "cliente": return v.cliente;
    // Apóstrofo: a planilha guarda como texto (senão o ICCID vira número científico e perde dígitos)
    case "iccid": return v.iccid ? `'${v.iccid}` : "";
    case "smart": return v.smart ?? "";
    case "ativacao": return date(v.ativacao);
    case "venda": return money(v.vendaCents);
    case "valor": return money(v.valorCents);
    case "vencimento": return date(v.vencimento);
    default: return "";
  }
}

/** ID da planilha a partir do link do navegador (ou o próprio ID colado). */
export function spreadsheetIdFromUrl(input: string): string | null {
  const s = input.trim();
  const m = /\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/.exec(s);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{20,}$/.test(s) ? s : null;
}

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

export function fieldForHeader(h: string): SheetField | null {
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

/**
 * Nomes das colunas escolhidos pelo dono (Configurações → Nomes das colunas — D35). Ex.: o gestor
 * renomeou "ICCID" para "CD" → { iccid: "CD" }. Vários nomes separados por ";". Campo sem nome:
 * o sistema reconhece sozinho pelos nomes de sempre.
 */
export type ColumnNames = Partial<Record<SheetField, string>>;

const splitNames = (v: string | undefined) => (v ?? "").split(";").map((x) => normalizeHeader(x)).filter(Boolean);

/** Valida os nomes vindos do formulário ou do banco (só campos conhecidos, até 120 letras). */
export function parseColumnNames(input: unknown): { names: ColumnNames; errors: string[] } {
  const obj = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const names: ColumnNames = {};
  const errors: string[] = [];
  const owner = new Map<string, SheetField>();
  for (const f of SHEET_FIELDS) {
    const v = String(obj[f] ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
    if (!v) continue;
    for (const n of splitNames(v)) {
      const other = owner.get(n);
      if (other) errors.push(`O nome “${n}” está em ${FIELD_LABEL[other]} e em ${FIELD_LABEL[f]} — cada coluna só pode ter um uso.`);
      owner.set(n, f);
    }
    names[f] = v;
  }
  return { names, errors };
}

/**
 * Mapa coluna→campo de uma linha de cabeçalho. Precisa ter pelo menos a coluna Número.
 * Primeiro os nomes escolhidos no painel; o que faltar, pelos nomes de sempre (nas colunas que
 * sobraram). Se o nome escolhido não estiver na planilha, também cai nos nomes de sempre.
 */
export function mapHeader(row: string[], names: ColumnNames = {}): ColumnMap | null {
  const map: ColumnMap = {};
  const used = new Set<number>();
  const cells = row.map((c) => normalizeHeader(String(c ?? "")));
  for (const f of SHEET_FIELDS) {
    const want = splitNames(names[f]);
    if (!want.length) continue;
    const i = cells.findIndex((c, idx) => !used.has(idx) && want.includes(c));
    if (i >= 0) {
      map[f] = i;
      used.add(i);
    }
  }
  row.forEach((cell, i) => {
    if (used.has(i)) return;
    const f = fieldForHeader(String(cell ?? ""));
    if (f && map[f] === undefined) {
      map[f] = i;
      used.add(i);
    }
  });
  return map.numero === undefined ? null : map;
}

/** Procura o cabeçalho nas primeiras linhas da aba. */
export function findHeader(rows: string[][], maxScan = 10, names: ColumnNames = {}): { index: number; map: ColumnMap } | null {
  for (let i = 0; i < Math.min(rows.length, maxScan); i++) {
    const map = mapHeader(rows[i] ?? [], names);
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

/** Trecho de texto com formatação própria (ex.: "100+100" em vermelho dentro do Smart-Dados). */
export type TextRun = { startIndex?: number; format?: Record<string, unknown> };

/**
 * Copia o "desenho" da formatação de uma célula modelo para um texto novo: o trecho numérico
 * (ex.: "100+100") recebe o formato que o trecho numérico tem no modelo, e o resto recebe o
 * formato do começo do modelo. "Franquia de 100+100GB" (100+100 vermelho) → "Franquia de 300+100GB"
 * com 300+100 vermelho. Sem trecho numérico ou sem formatação no modelo: null (texto simples).
 */
export function mirrorTextRuns(text: string, refText: string, refRuns: TextRun[] | undefined | null): TextRun[] | null {
  if (!refRuns?.length) return null;
  const formatAt = (i: number) => {
    let f: Record<string, unknown> | undefined;
    for (const r of [...refRuns].sort((a, b) => (a.startIndex ?? 0) - (b.startIndex ?? 0))) if ((r.startIndex ?? 0) <= i) f = r.format;
    return f ?? {};
  };
  const ref = /\d[\d+.,]*\d|\d/.exec(refText);
  const cur = /\d[\d+.,]*\d|\d/.exec(text);
  if (!ref || !cur) return null;
  const base = formatAt(0);
  const digits = formatAt(ref.index);
  const after = formatAt(ref.index + ref[0].length);
  const runs: TextRun[] = [{ startIndex: 0, format: base }];
  runs.push({ startIndex: cur.index, format: digits });
  if (cur.index + cur[0].length < text.length) runs.push({ startIndex: cur.index + cur[0].length, format: after });
  // Se o número está no começo, o primeiro trecho já é o numérico
  return cur.index === 0 ? runs.slice(1) : runs;
}

/* ------------------------------------------------------------------ */
/* Situação da escrita na planilha (o que o painel mostra)             */
/* ------------------------------------------------------------------ */

/** Depois disso, uma linha pendente sem erro deixa de ser "escrevendo" e vira "na fila". */
export const SHEET_STUCK_AFTER_MS = 2 * 60 * 1000;

/**
 * - erro: a última tentativa falhou (mostra o motivo e "Tentar de novo");
 * - escrevendo: acabou de ser marcada (a página se atualiza sozinha);
 * - na_fila: está pendente há mais de 2 min sem erro registrado (ex.: a escrita imediata caiu no
 *   meio) — a rotina de 10 em 10 min tenta de novo;
 * - ok: escrita com sucesso; nenhum: nunca foi escrita.
 */
export type SheetWriteState = "erro" | "escrevendo" | "na_fila" | "ok" | "nenhum";

export function sheetWriteState(
  l: { pending: boolean; error: string | null; syncedAt?: Date | string | null; updatedAt?: Date | string | null },
  now: Date,
): SheetWriteState {
  if (l.error) return "erro";
  if (l.pending) {
    const since = l.updatedAt ? new Date(l.updatedAt).getTime() : NaN;
    if (!Number.isFinite(since) || now.getTime() - since > SHEET_STUCK_AFTER_MS) return "na_fila";
    return "escrevendo";
  }
  return l.syncedAt ? "ok" : "nenhum";
}

/** Erro do banco por coluna/tabela que não existe (migração não rodada no Supabase). */
export function isMissingSchemaError(e: unknown): boolean {
  const code = (e as { code?: unknown } | null)?.code;
  if (code === "42703" || code === "42P01") return true;
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return /(column|relation) .+ does not exist/i.test(msg);
}

/**
 * Mensagem de erro que vai para sheet_error e para a tela: sem números longos (ICCID, IMEI, EID,
 * CPF — dados sensíveis nunca aparecem) e, se faltar migração, já diz o que fazer.
 */
export function sheetErrorMessage(e: unknown): string {
  const raw = (e instanceof Error ? e.message : String(e ?? "erro desconhecido")).replace(/\d{11,}/g, "•••");
  const msg = raw.length > 300 ? `${raw.slice(0, 300)}…` : raw;
  return isMissingSchemaError(e)
    ? `Falta rodar uma migração no Supabase (veja Painel → Integrações). Detalhe: ${msg}`
    : msg;
}

/* ------------------------------------------------------------------ */
/* Migrações que o banco precisa ter (Painel → Integrações)            */
/* ------------------------------------------------------------------ */

/** Tabelas/colunas criadas por cada migração recente — usadas para avisar "migração pendente". */
export const EXPECTED_SCHEMA: { file: string; objects: string[] }[] = [
  {
    file: "20261120000002_bloqueio_por_atraso.sql",
    objects: ["lines.suspension_requested_at", "lines.reactivation_requested_at", "lines.reactivated_at"],
  },
  {
    file: "20261121000010_inadimplencia.sql",
    objects: ["overdue_payments", "line_blocks", "lines.asaas_customer_id"],
  },
  { file: "20261121000011_planilha_google.sql", objects: ["lines.sheet_pending", "lines.sheet_error", "lines.sheet_synced_at"] },
  { file: "20261121000012_posicao_na_planilha.sql", objects: ["lines.sheet_tab", "lines.sheet_gid", "lines.sheet_row"] },
  { file: "20261121000013_redefinir_senha_equipe.sql", objects: ["staff_password_resets"] },
  { file: "20261121000014_editar_linha.sql", objects: ["lines.sheet_overwrite"] },
  { file: "20261122000015_chip_fisico_sem_imei.sql", objects: ["device_info.image_kind"] },
];

/**
 * Compara o esperado com o que existe no banco. `present` tem nomes de tabela ("line_blocks") e
 * de coluna ("lines.sheet_overwrite"). Devolve só as migrações com algo faltando, na ordem.
 */
export function missingMigrations(
  present: Set<string>,
  expected = EXPECTED_SCHEMA,
): { file: string; missing: string[] }[] {
  return expected
    .map((m) => ({ file: m.file, missing: m.objects.filter((o) => !present.has(o)) }))
    .filter((m) => m.missing.length > 0);
}

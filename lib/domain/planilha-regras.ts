/**
 * Regras da planilha do gestor que o dono pode mudar no painel (Configurações) — D34.
 *
 * Cada regra diz: QUANDO (ativar / bloquear / desbloquear a linha), em QUAL COLUNA (pelo nome do
 * cabeçalho) e O QUE FAZER (escrever um texto, mudar a cor do texto, mudar a cor do fundo).
 * Opcional: só aplicar se o valor atual da célula for um dos listados.
 *
 * Exemplo padrão: ao ativar, coluna "Gestor" passa de "Falta Bloquear Gestor" / "Gestor Bloqueio"
 * para "Gestor Ativo". Se o gestor pedir "Ativo", basta trocar o texto no painel.
 */
import { fieldForHeader, normalizeHeader, type ColumnMap } from "./planilha";

export const RULE_EVENTS = ["ativar", "bloquear", "desbloquear"] as const;
export type RuleEvent = (typeof RULE_EVENTS)[number];

export const EVENT_LABEL: Record<RuleEvent, string> = {
  ativar: "Ao ativar a linha",
  bloquear: "Ao bloquear (falta de pagamento)",
  desbloquear: "Ao desbloquear (pagou)",
};

/** Cores que dá para escolher (nome → cor). Poucas e claras, para não errar. */
export const RULE_COLORS = {
  preto: { label: "Preto", hex: "#000000" },
  branco: { label: "Branco", hex: "#ffffff" },
  vermelho: { label: "Vermelho", hex: "#cc0000" },
  verde: { label: "Verde", hex: "#38761d" },
  azul: { label: "Azul", hex: "#1155cc" },
  amarelo: { label: "Amarelo", hex: "#ffff00" },
  laranja: { label: "Laranja", hex: "#ff9900" },
  cinza: { label: "Cinza", hex: "#999999" },
} as const;
export type RuleColor = keyof typeof RULE_COLORS;

export type SheetRule = {
  quando: RuleEvent;
  coluna: string; // nome do cabeçalho, como está na planilha
  escrever: string | null; // texto novo (null = não mexe no texto)
  corTexto: RuleColor | null;
  corFundo: RuleColor | null;
  /** Só aplica se o valor atual for um destes (separados por ";"). null = sempre. */
  seValor: string | null;
};

export const MAX_RULES = 30;

/** Regras de fábrica: o que o sistema já fazia + a coluna Gestor. */
export const DEFAULT_RULES: SheetRule[] = [
  { quando: "ativar", coluna: "Gestor", escrever: "Gestor Ativo", corTexto: null, corFundo: null, seValor: null },
  { quando: "ativar", coluna: "Cliente", escrever: null, corTexto: "preto", corFundo: null, seValor: null },
  { quando: "bloquear", coluna: "Cliente", escrever: null, corTexto: "vermelho", corFundo: null, seValor: null },
  { quando: "desbloquear", coluna: "Cliente", escrever: null, corTexto: "preto", corFundo: null, seValor: null },
];

const clean = (v: unknown, max: number): string | null => {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
};
const color = (v: unknown): RuleColor | null => (typeof v === "string" && v in RULE_COLORS ? (v as RuleColor) : null);

/** Coluna que a regra não pode mexer: o Número é o que liga a planilha ao sistema. */
export function isProtectedColumn(coluna: string): boolean {
  const n = normalizeHeader(coluna);
  return n.includes("numero") || n === "linha" || n === "msisdn";
}

/**
 * Valida as regras vindas do formulário ou do banco. Regra sem coluna ou sem nenhuma ação é
 * ignorada; coluna protegida vira erro (para o dono saber por que não salvou).
 */
export function parseRules(input: unknown): { rules: SheetRule[]; errors: string[] } {
  const list = Array.isArray(input) ? input : [];
  const rules: SheetRule[] = [];
  const errors: string[] = [];
  list.forEach((raw, i) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const coluna = clean(r.coluna, 60);
    const escrever = clean(r.escrever, 100);
    const corTexto = color(r.corTexto);
    const corFundo = color(r.corFundo);
    if (!coluna && !escrever && !corTexto && !corFundo) return; // linha em branco
    if (!RULE_EVENTS.includes(r.quando as RuleEvent)) return void errors.push(`Regra ${i + 1}: escolha quando ela vale.`);
    // Diz em qual grupo da tela está a regra (é assim que o dono acha)
    const n = `${EVENT_LABEL[r.quando as RuleEvent]}${coluna ? `, coluna “${coluna}”` : ""}`;
    if (!coluna) return void errors.push(`${n}: escreva o nome da coluna.`);
    if (isProtectedColumn(coluna)) return void errors.push(`${n}: essa coluna não pode ser alterada (é ela que liga a planilha ao sistema).`);
    if (!escrever && !corTexto && !corFundo) return void errors.push(`${n}: diga o que fazer (texto novo ou uma cor).`);
    rules.push({ quando: r.quando as RuleEvent, coluna, escrever, corTexto, corFundo, seValor: clean(r.seValor, 200) });
  });
  if (rules.length > MAX_RULES) errors.push(`No máximo ${MAX_RULES} regras.`);
  return { rules: rules.slice(0, MAX_RULES), errors };
}

/**
 * Acha a coluna da regra no cabeçalho da aba (sem diferença de maiúsculas e acentos). Se o nome
 * não estiver escrito igual, mas for uma coluna que o sistema já reconhece (ex.: regra "Cliente" e
 * cabeçalho "Nome do Cliente"), usa a mesma coluna que o sistema achou. -1 = não tem.
 */
export function ruleColumnIndex(headerRow: string[], coluna: string, map?: ColumnMap): number {
  const want = normalizeHeader(coluna);
  const exact = headerRow.findIndex((h) => normalizeHeader(String(h ?? "")) === want);
  if (exact >= 0 || !map) return exact;
  const field = fieldForHeader(coluna);
  return field && map[field] !== undefined ? map[field]! : -1;
}

/** A regra vale para o valor atual da célula? */
export function ruleConditionMatches(rule: SheetRule, current: string | null | undefined): boolean {
  if (!rule.seValor) return true;
  const atual = normalizeHeader(String(current ?? ""));
  return rule.seValor
    .split(";")
    .map((v) => normalizeHeader(v))
    .some((v) => v === atual);
}

/** Texto como vai para a planilha: nunca vira fórmula (=, +, -, @ no começo). */
export function ruleTextForSheet(text: string): string {
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

/** "#cc0000" → { red: 0.8, green: 0, blue: 0 } (formato do Google Planilhas). */
export function colorToRgb(c: RuleColor): { red: number; green: number; blue: number } {
  const hex = RULE_COLORS[c].hex.slice(1);
  const ch = (i: number) => Math.round((parseInt(hex.slice(i, i + 2), 16) / 255) * 1000) / 1000;
  return { red: ch(0), green: ch(2), blue: ch(4) };
}

/**
 * Qual momento levou a linha para a fila da planilha:
 * - bloqueada → bloquear;
 * - ativa e desbloqueada depois da ativação → desbloquear;
 * - ativa vendida pelo site → ativar.
 * Correção feita no painel ("Editar linha") não aplica regras: só corrige os dados da venda.
 */
export function eventForLine(l: {
  status: string;
  orderId: string | null;
  overwrite: boolean;
  activatedAt: Date | string | null;
  reactivatedAt: Date | string | null;
}): RuleEvent | null {
  if (["suspensa", "suspensao_pendente"].includes(l.status)) return "bloquear";
  if (l.overwrite) return null;
  if (l.status !== "ativa") return null;
  const t = (d: Date | string | null) => (d ? new Date(d).getTime() : NaN);
  const reat = t(l.reactivatedAt);
  if (Number.isFinite(reat) && !(t(l.activatedAt) > reat)) return "desbloquear";
  return l.orderId ? "ativar" : null;
}

/**
 * O que o sistema escreve em cada coluna da planilha na ativação — editável no painel (D36).
 *
 * Cada coluna tem um "modelo": texto livre com etiquetas entre colchetes, que viram os dados da
 * venda. Ex.: "[Nome do cliente]" → "Beatriz Rocha"; "[Nome do cliente] - pedido [Número do
 * pedido]" → "Beatriz Rocha - pedido 8". Modelo vazio = não escreve nessa coluna (menos Cliente).
 */
import { formatForSheet, normalizeHeader, WRITABLE_FIELDS, type SaleValues, type SheetField } from "./planilha";

/** Dados da venda que podem ir para a planilha. */
export type TemplateContext = SaleValues & {
  pedido: string | null; // "8" (sem #)
  plano: string | null; // "Plano 200GB"
};

export const TAGS = [
  { key: "nome", label: "Nome do cliente" },
  { key: "primeiro_nome", label: "Primeiro nome" },
  { key: "pedido", label: "Número do pedido" },
  { key: "plano", label: "Plano do site" },
  { key: "iccid", label: "ICCID" },
  { key: "smart", label: "Smart-Dados" },
  { key: "ativacao", label: "Data de ativação" },
  { key: "venda", label: "Venda final" },
  { key: "valor", label: "Valor do gestor" },
  { key: "vencimento", label: "Vencimento" },
  { key: "dia_vencimento", label: "Dia do vencimento" },
] as const;
export type TagKey = (typeof TAGS)[number]["key"];

export type Templates = Partial<Record<SheetField, string>>;

/** De fábrica: o mesmo de sempre (cada coluna com o seu dado). */
export const DEFAULT_TEMPLATES: Templates = {
  cliente: "[Nome do cliente]",
  iccid: "[ICCID]",
  smart: "[Smart-Dados]",
  ativacao: "[Data de ativação]",
  venda: "[Venda final]",
  valor: "[Valor do gestor]",
  vencimento: "[Vencimento]",
};

/** Etiqueta "sozinha" de cada coluna → usa o formato próprio (data de verdade, R$, ICCID como texto). */
const NATIVE: Partial<Record<TagKey, SheetField>> = {
  iccid: "iccid", smart: "smart", ativacao: "ativacao", venda: "venda", valor: "valor", vencimento: "vencimento",
};

const tagByName = new Map<string, TagKey>(TAGS.map((t) => [normalizeHeader(t.label), t.key]));

function tagValue(key: TagKey, ctx: TemplateContext, locale: string): string {
  const native = NATIVE[key];
  if (native) return formatForSheet(native, ctx, locale).replace(/^'/, "");
  switch (key) {
    case "nome": return ctx.cliente;
    case "primeiro_nome": return ctx.cliente.trim().split(/\s+/)[0] ?? "";
    case "pedido": return ctx.pedido ?? "";
    case "plano": return ctx.plano ?? "";
    case "dia_vencimento": return ctx.vencimento ? String(Number(ctx.vencimento.slice(8, 10))) : "";
    default: return "";
  }
}

/**
 * Monta o texto do modelo. Etiqueta desconhecida fica como está. Se o modelo é só uma etiqueta de
 * data/R$/ICCID, sai no formato próprio da planilha (data de verdade, moeda, ICCID como texto).
 * Texto nunca vira fórmula.
 */
export function renderTemplate(tpl: string, ctx: TemplateContext, locale: string): string {
  const only = /^\s*\[([^\]]+)\]\s*$/.exec(tpl);
  if (only) {
    const key = tagByName.get(normalizeHeader(only[1]));
    const native = key && NATIVE[key];
    if (native) return formatForSheet(native, ctx, locale);
  }
  const out = tpl.replace(/\[([^\]]+)\]/g, (m, name: string) => {
    const key = tagByName.get(normalizeHeader(name));
    return key ? tagValue(key, ctx, locale) : m;
  });
  return /^[=+\-@]/.test(out) ? `'${out}` : out;
}

/** Etiquetas desconhecidas no modelo (para avisar o dono — provavelmente erro de digitação). */
export function unknownTags(tpl: string): string[] {
  return [...tpl.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]).filter((n) => !tagByName.has(normalizeHeader(n)));
}

export function parseTemplates(input: unknown): { templates: Templates; errors: string[] } {
  const obj = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const templates: Templates = {};
  const errors: string[] = [];
  const LABEL: Partial<Record<SheetField, string>> = {
    cliente: "Cliente", iccid: "ICCID", smart: "Smart-Dados", ativacao: "Ativação", venda: "Venda final", valor: "Valor", vencimento: "Vencimento",
  };
  for (const f of WRITABLE_FIELDS) {
    if (!(f in obj)) continue;
    const v = String(obj[f] ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
    const bad = unknownTags(v);
    if (bad.length) errors.push(`${LABEL[f]}: não conheço ${bad.map((b) => `[${b}]`).join(", ")} — use os botões das etiquetas.`);
    // Cliente precisa do nome: é por ele que o sistema confere de quem é a linha
    const keys = [...v.matchAll(/\[([^\]]+)\]/g)].map((m) => tagByName.get(normalizeHeader(m[1])));
    if (f === "cliente" && !keys.includes("nome") && !keys.includes("primeiro_nome")) {
      errors.push("Cliente: precisa ter [Nome do cliente] ou [Primeiro nome].");
    }
    templates[f] = v;
  }
  return { templates, errors };
}

/** Modelos em uso: os salvos por cima dos de fábrica. */
export function effectiveTemplates(saved: Templates): Templates {
  return { ...DEFAULT_TEMPLATES, ...saved };
}

/** Nome que deve estar na coluna Cliente para a linha ser deste cliente (conferência de segurança). */
export function expectedClientText(tpl: string | undefined, ctx: TemplateContext, locale: string): string {
  return renderTemplate(tpl || DEFAULT_TEMPLATES.cliente!, ctx, locale).replace(/^'/, "");
}

/** Exemplo para a prévia na tela. */
export const EXAMPLE_CONTEXT: TemplateContext = {
  cliente: "Beatriz Rocha", pedido: "8", plano: "Plano 200GB", iccid: "89551093000000000012", smart: "Franquia de 200+100GB",
  ativacao: "2026-11-20", vendaCents: 14999, valorCents: 3250, vencimento: "2026-12-20",
};

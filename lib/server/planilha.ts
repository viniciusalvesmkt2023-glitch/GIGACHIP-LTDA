import "server-only";
import { normalizeName } from "@/lib/domain/inadimplencia";
import {
  columnLetter,
  FIELD_LABEL,
  findHeader,
  isAvailableMarker,
  mirrorTextRuns,
  parseSheetRows,
  quoteTab,
  sheetErrorMessage,
  WRITABLE_FIELDS,
  parseColumnNames,
  type ColumnMap,
  type ColumnNames,
  type SheetField,
  type SheetRow,
} from "@/lib/domain/planilha";
import {
  colorToRgb,
  DEFAULT_RULES,
  eventForLine,
  parseRules,
  ruleColumnIndex,
  ruleConditionMatches,
  type SheetRule,
} from "@/lib/domain/planilha-regras";
import {
  effectiveTemplates,
  expectedClientText,
  parseTemplates,
  renderTemplate,
  type TemplateContext,
  type Templates,
} from "@/lib/domain/planilha-modelos";
import { shortOrderNumber } from "@/lib/domain/money";
import { sheetRequests, sheets, sheetsConfigured, SheetsError } from "@/lib/integrations/google/sheets";
import { sql } from "./db";
import type { Staff } from "./staff-auth";

/**
 * Planilha do gestor no Google Planilhas (D30). A planilha é a oficial (o gestor usa):
 * - leitura: números novos sem cliente → "disponíveis"; linhas com cliente → clientes antigos;
 * - escrita: ativação preenche as colunas da venda; bloqueio pinta o nome de vermelho.
 * Login Vivo, Número, Plano PJ e Forma de pagamento são do gestor e nunca são escritos.
 */

const CONFIG_KEY = "planilha_google";
const READ_KEY = "planilha_lida_em";
const READ_EVERY_MINUTES = 55;
const RULES_KEY = "planilha_regras";
const NAMES_KEY = "planilha_colunas";
const TEMPLATES_KEY = "planilha_modelos";

export type SheetConfig = { spreadsheetId: string; tab: string | null };

export async function getSheetConfig(): Promise<SheetConfig | null> {
  const [row] = await sql()<{ value: SheetConfig }[]>`select value from public.app_settings where key = ${CONFIG_KEY}`;
  return row?.value?.spreadsheetId ? row.value : null;
}

export async function setSheetConfig(staff: Staff, cfg: SheetConfig): Promise<void> {
  await sql()`
    insert into public.app_settings (key, value, updated_by, updated_at)
    values (${CONFIG_KEY}, ${sql().json(cfg)}, ${staff.id}, now())
    on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`;
  await sql()`
    insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
    values (${staff.id}, 'configurar_planilha', 'app_settings', ${CONFIG_KEY}, ${sql().json({ aba: cfg.tab })})`;
}

/** Regras da planilha (Configurações). Sem nada salvo: as de fábrica. */
export async function getSheetRules(): Promise<SheetRule[]> {
  const [row] = await sql()<{ value: unknown }[]>`select value from public.app_settings where key = ${RULES_KEY}`;
  return row ? parseRules(row.value).rules : DEFAULT_RULES;
}

export async function setSheetRules(staff: Staff, rules: SheetRule[]): Promise<void> {
  await sql()`
    insert into public.app_settings (key, value, updated_by, updated_at)
    values (${RULES_KEY}, ${sql().json(rules)}, ${staff.id}, now())
    on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`;
  await sql()`
    insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
    values (${staff.id}, 'regras_planilha', 'app_settings', ${RULES_KEY}, ${sql().json({ regras: rules.length })})`;
}

/** Nomes das colunas escolhidos no painel (vazio = reconhece sozinho). */
export async function getColumnNames(): Promise<ColumnNames> {
  const [row] = await sql()<{ value: unknown }[]>`select value from public.app_settings where key = ${NAMES_KEY}`;
  return row ? parseColumnNames(row.value).names : {};
}

export async function setColumnNames(staff: Staff, names: ColumnNames): Promise<void> {
  await sql()`
    insert into public.app_settings (key, value, updated_by, updated_at)
    values (${NAMES_KEY}, ${sql().json(names)}, ${staff.id}, now())
    on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`;
  await sql()`
    insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
    values (${staff.id}, 'nomes_colunas_planilha', 'app_settings', ${NAMES_KEY}, ${sql().json({ campos: Object.keys(names) })})`;
}

/** O que escrever em cada coluna (só o que o dono mudou; o resto é de fábrica). */
export async function getTemplates(): Promise<Templates> {
  const [row] = await sql()<{ value: unknown }[]>`select value from public.app_settings where key = ${TEMPLATES_KEY}`;
  return row ? parseTemplates(row.value).templates : {};
}

export async function setTemplates(staff: Staff, templates: Templates): Promise<void> {
  await sql()`
    insert into public.app_settings (key, value, updated_by, updated_at)
    values (${TEMPLATES_KEY}, ${sql().json(templates)}, ${staff.id}, now())
    on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`;
  await sql()`
    insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
    values (${staff.id}, 'modelos_planilha', 'app_settings', ${TEMPLATES_KEY}, ${sql().json({ campos: Object.keys(templates) })})`;
}

/**
 * Tudo o que a tela Configurações mostra, numa consulta só (antes eram 5 idas ao banco).
 * `custo_linha_gestor_cents` é o valor do gestor (mesma regra de getLineCostCents).
 */
export async function configPageSettings() {
  const COST = "custo_linha_gestor_cents";
  const MIN = "inadimplencia_valor_minimo_cents";
  const rows = await sql()<{ key: string; value: unknown }[]>`
    select key, value from public.app_settings
    where key = any(${[COST, MIN, CONFIG_KEY, RULES_KEY, NAMES_KEY, TEMPLATES_KEY]})`;
  const v = new Map(rows.map((r) => [r.key, r.value]));
  const cost = Number(v.get(COST));
  const sheet = v.get(CONFIG_KEY) as SheetConfig | undefined;
  const min = Number(v.get(MIN));
  return {
    costCents: Number.isFinite(cost) && cost >= 0 ? cost : 3000,
    minOverdueCents: Number.isFinite(min) && min >= 0 ? min : 10000,
    sheet: sheet?.spreadsheetId ? sheet : null,
    rules: v.has(RULES_KEY) ? parseRules(v.get(RULES_KEY)).rules : DEFAULT_RULES,
    names: v.has(NAMES_KEY) ? parseColumnNames(v.get(NAMES_KEY)).names : {},
    templates: v.has(TEMPLATES_KEY) ? parseTemplates(v.get(TEMPLATES_KEY)).templates : {},
  };
}

export async function sheetEnabled(): Promise<boolean> {
  return sheetsConfigured() && (await getSheetConfig()) !== null;
}

type TabData = {
  title: string; sheetId: number; headerIndex: number; map: ColumnMap; rows: SheetRow[]; invalid: number[]; duplicates: Map<string, number[]>;
  /** Cabeçalho e valores como estão (para as regras de Configurações). */
  header: string[]; values: string[][];
};

/** Lê todas as abas (ou só a configurada) que têm um cabeçalho com a coluna "Número". */
export async function readSheet() {
  const cfg = await getSheetConfig();
  if (!cfg) throw new Error("Link da planilha não configurado (Configurações)");
  const meta = await sheets.meta(cfg.spreadsheetId);
  const wanted = cfg.tab ? meta.sheets.filter((s) => s.properties.title === cfg.tab) : meta.sheets;
  if (cfg.tab && !wanted.length) throw new Error(`Aba "${cfg.tab}" não encontrada na planilha`);
  const names = await getColumnNames();
  const tabs: TabData[] = [];
  for (const s of wanted) {
    const { values = [] } = await sheets.values(cfg.spreadsheetId, `${quoteTab(s.properties.title)}!A1:AZ5000`);
    const header = findHeader(values, 10, names);
    if (!header) continue;
    const parsed = parseSheetRows(values, header);
    tabs.push({
      title: s.properties.title, sheetId: s.properties.sheetId, headerIndex: header.index, map: header.map, ...parsed,
      header: (values[header.index] ?? []).map((c) => String(c ?? "")), values,
    });
  }
  return { spreadsheetId: cfg.spreadsheetId, title: meta.properties.title, locale: meta.properties.locale ?? "pt_BR", tabs };
}

/** Teste do painel: mostra o que o sistema entendeu da planilha, sem escrever nada. */
export async function describeSheet() {
  const [s, rules] = await Promise.all([readSheet(), getSheetRules()]);
  const ruleCols = [...new Set(rules.map((r) => r.coluna))];
  return {
    title: s.title,
    tabs: s.tabs.map((t) => ({
      title: t.title,
      headerRow: t.headerIndex + 1,
      columns: (Object.entries(t.map) as [SheetField, number][]).map(([f, i]) => `${FIELD_LABEL[f]} = coluna ${columnLetter(i)}`),
      missing: WRITABLE_FIELDS.filter((f) => t.map[f] === undefined).map((f) => FIELD_LABEL[f]),
      total: t.rows.length,
      disponiveis: t.rows.filter((r) => r.kind === "disponivel").length,
      clientes: t.rows.filter((r) => r.kind === "cliente").length,
      problems: t.rows.filter((r) => r.kind === "inconsistente").map((r) => `linha ${r.rowNumber}: ${r.problem}`),
      invalid: t.invalid.slice(0, 10),
      duplicates: [...t.duplicates.values()].slice(0, 10),
      ruleColumnsMissing: ruleCols.filter((c) => ruleColumnIndex(t.header, c, t.map) === -1),
    })),
  };
}

const at = (iso: string | null) => (iso ? `${iso} 12:00:00-03` : null);

/**
 * Traz da planilha para o sistema. Números novos sem cliente entram como disponíveis; com cliente,
 * como clientes antigos. Linhas vendidas pelo site (com pedido) só recebem as colunas do gestor.
 */
export async function importFromSheet(staff: Staff | null) {
  const s = await readSheet();
  const rows: SheetRow[] = [];
  const seen = new Set<string>();
  for (const t of s.tabs) for (const r of t.rows) if (!seen.has(r.msisdn)) { seen.add(r.msisdn); rows.push(r); }

  const existing = new Map(
    (
      await sql()<{ id: string; msisdn: string; order_id: string | null; status: string; sheet_pending: boolean; legacy_customer_name: string | null }[]>`
        select id, msisdn, order_id, status::text, sheet_pending, legacy_customer_name
        from public.lines where msisdn = any(${rows.map((r) => r.msisdn)})`
    ).map((l) => [l.msisdn, l]),
  );
  const stats = { novosDisponiveis: 0, novosClientes: 0, atualizados: 0, liberados: 0, foraDaLista: 0, inconsistentes: 0 };

  for (const r of rows) {
    const cur = existing.get(r.msisdn);
    if (r.kind === "inconsistente") {
      // Planilha com problema nesta linha: não entra como disponível (e sai da lista se já estava)
      stats.inconsistentes++;
      // Também remove o que uma leitura antiga gravou como "cliente" chamado "Disponível"
      if (cur && !cur.order_id && (cur.status === "disponivel" || isAvailableMarker(cur.legacy_customer_name))) {
        const del = await sql()`
          delete from public.lines l where l.id = ${cur.id} and l.order_id is null
            and not exists (select 1 from public.line_blocks b where b.line_id = l.id)
          returning id`;
        stats.foraDaLista += del.length;
      }
      continue;
    }
    if (!cur) {
      if (r.kind === "cliente") {
        await sql()`
          insert into public.lines (msisdn, status, vivo_login, plano_pj, payment_method, legacy_customer_name, iccid, smart_dados,
                                    activated_at, sale_price_cents, cost_cents, legacy_due_date)
          values (${r.msisdn}, 'ativa', ${r.login}, ${r.plano}, ${r.pagamento}, ${r.cliente}, ${r.iccid}, ${r.smart},
                  ${at(r.ativacao)}, ${r.vendaCents}, ${r.valorCents}, ${r.vencimento})
          on conflict (msisdn) do nothing`;
        stats.novosClientes++;
      } else {
        await sql()`
          insert into public.lines (msisdn, status, vivo_login, plano_pj, payment_method)
          values (${r.msisdn}, 'disponivel', ${r.login}, ${r.plano}, ${r.pagamento})
          on conflict (msisdn) do nothing`;
        stats.novosDisponiveis++;
      }
      continue;
    }
    // Colunas do gestor: a planilha manda
    await sql()`
      update public.lines set vivo_login = ${r.login}, plano_pj = ${r.plano}, payment_method = coalesce(${r.pagamento}, payment_method)
      where id = ${cur.id}
        and (vivo_login is distinct from ${r.login} or plano_pj is distinct from ${r.plano}
             or (${r.pagamento}::text is not null and payment_method is distinct from ${r.pagamento}))`;
    if (cur.order_id || cur.sheet_pending) continue; // vendida pelo site ou com escrita pendente: o sistema manda
    if (r.kind === "cliente") {
      const res = await sql()`
        update public.lines
        set legacy_customer_name = ${r.cliente}, iccid = ${r.iccid}, smart_dados = ${r.smart}, activated_at = ${at(r.ativacao)},
            sale_price_cents = ${r.vendaCents}, cost_cents = ${r.valorCents}, legacy_due_date = ${r.vencimento},
            status = case when status = 'disponivel' then 'ativa'::public.line_status else status end
        where id = ${cur.id}
          and (legacy_customer_name is distinct from ${r.cliente} or iccid is distinct from ${r.iccid}
               or smart_dados is distinct from ${r.smart} or sale_price_cents is distinct from ${r.vendaCents}
               or cost_cents is distinct from ${r.valorCents} or legacy_due_date is distinct from ${r.vencimento}::date
               or status = 'disponivel')
        returning id`;
      if (res.length) stats.atualizados++;
    } else if (cur.status === "ativa") {
      // O gestor apagou o cliente da linha: o número voltou a ficar livre
      await sql()`
        update public.lines
        set status = 'disponivel', legacy_customer_name = null, iccid = null, smart_dados = null, activated_at = null,
            sale_price_cents = null, cost_cents = null, legacy_due_date = null, asaas_customer_id = null
        where id = ${cur.id} and order_id is null`;
      stats.liberados++;
    }
  }

  // Posição de cada número na planilha (o "1, 2, 3" da lateral), para o painel mostrar na mesma ordem
  const pos = new Map<string, { tab: string; gid: number; row: number }>();
  for (const t of s.tabs) for (const r of t.rows) if (!pos.has(r.msisdn)) pos.set(r.msisdn, { tab: t.title, gid: t.sheetId, row: r.rowNumber });
  const list = [...pos.entries()];
  if (list.length) {
    await sql()`
      update public.lines l set sheet_tab = v.tab, sheet_gid = v.gid, sheet_row = v.row
      from unnest(${list.map(([m]) => m)}::text[], ${list.map(([, p]) => p.tab)}::text[],
                  ${list.map(([, p]) => p.gid)}::int[], ${list.map(([, p]) => p.row)}::int[]) as v(msisdn, tab, gid, row)
      where l.msisdn = v.msisdn
        and (l.sheet_row is distinct from v.row or l.sheet_tab is distinct from v.tab or l.sheet_gid is distinct from v.gid)`;
  }
  await sql()`
    update public.lines set sheet_tab = null, sheet_gid = null, sheet_row = null
    where sheet_row is not null and not (msisdn = any(${list.map(([m]) => m)}::text[]))`;

  await sql()`
    insert into public.app_settings (key, value, updated_at) values (${READ_KEY}, ${sql().json(new Date().toISOString())}, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
  await sql()`
    insert into public.audit_log (actor_id, action, entity, metadata)
    values (${staff?.id ?? null}, 'ler_planilha', 'lines', ${sql().json({ ...stats, numeros: rows.length })})`;
  return { ...stats, numeros: rows.length };
}

export async function lastSheetRead(): Promise<Date | null> {
  const [row] = await sql()<{ value: unknown }[]>`select value from public.app_settings where key = ${READ_KEY}`;
  return typeof row?.value === "string" ? new Date(row.value) : null;
}

/** Rotina: lê a planilha no máximo 1 vez por hora (números novos do gestor). */
export async function importFromSheetIfDue() {
  if (!(await sheetEnabled())) return { skipped: "planilha não configurada" };
  const last = await lastSheetRead();
  if (last && Date.now() - last.getTime() < READ_EVERY_MINUTES * 60_000) return { skipped: "lida há pouco" };
  return importFromSheet(null);
}

/**
 * Escreve na planilha as linhas marcadas como pendentes (ativação, bloqueio, desbloqueio).
 * Lê a planilha uma vez e acha cada número pela coluna "Número".
 */
export async function pushPendingToSheet(limit = 20) {
  if (!(await sheetEnabled())) return { skipped: "planilha não configurada" };
  let pending: {
    id: string; msisdn: string; status: string; order_id: string | null; customer: string | null; iccid: string | null;
    smart_dados: string | null; activated_at: Date | null; sale_price_cents: number | null; cost_cents: number | null; due: string | null;
    sheet_overwrite: boolean; reactivated_at: Date | null; code: string | null; plan_name: string | null;
  }[];
  try {
    pending = await sql()<
    {
      id: string; msisdn: string; status: string; order_id: string | null; customer: string | null; iccid: string | null;
      smart_dados: string | null; activated_at: Date | null; sale_price_cents: number | null; cost_cents: number | null; due: string | null;
      sheet_overwrite: boolean; reactivated_at: Date | null; code: string | null; plan_name: string | null;
    }[]
  >`
    select l.id, l.msisdn, l.status::text, l.order_id, l.sheet_overwrite, l.reactivated_at, o.code, o.plan_snapshot->>'name' as plan_name, coalesce(c.full_name, l.legacy_customer_name) as customer, l.iccid,
           l.smart_dados, l.activated_at, l.sale_price_cents, l.cost_cents, coalesce(s.next_due_date, l.legacy_due_date)::text as due
    from public.lines l
    left join public.orders o on o.id = l.order_id
    left join public.customers c on c.id = o.customer_id
    left join public.subscriptions s on s.order_id = o.id
    where l.sheet_pending
    order by l.updated_at limit ${limit}`;
  } catch (err) {
    // Falhou antes de chegar no Google (ex.: migração não rodada): grava o motivo nas linhas da fila
    // para o painel mostrar, em vez de "escrevendo…" para sempre. Elas continuam pendentes.
    const msg = sheetErrorMessage(err);
    console.error(`[planilha] ${msg}`);
    const marked = await sql()`update public.lines set sheet_error = ${msg} where sheet_pending`.catch(() => null);
    return { written: 0, failed: marked?.count ?? 0, error: msg };
  }
  if (!pending.length) return { written: 0, failed: 0 };

  let sheet: Awaited<ReturnType<typeof readSheet>>;
  let rules: SheetRule[];
  let templates: Templates;
  try {
    [sheet, rules, templates] = await Promise.all([readSheet(), getSheetRules(), getTemplates().then(effectiveTemplates)]);
  } catch (err) {
    const msg = sheetErrorMessage(err);
    await sql()`update public.lines set sheet_error = ${msg} where id = any(${pending.map((p) => p.id)})`;
    return { written: 0, failed: pending.length, error: msg };
  }
  if (!sheet.tabs.length) {
    // Nenhuma aba com a coluna Número: provavelmente o gestor mudou o nome do cabeçalho
    const msg = "não achei a coluna Número em nenhuma aba da planilha — se o gestor mudou o nome, informe o nome novo em Configurações → Nomes das colunas";
    await sql()`update public.lines set sheet_error = ${msg} where id = any(${pending.map((p) => p.id)})`;
    return { written: 0, failed: pending.length, error: msg };
  }
  const where = new Map<string, { tab: TabData; row: SheetRow }>();
  // Número que aparece mais de uma vez (na mesma aba ou em abas diferentes): onde está cada um
  const repeated = new Map<string, string[]>();
  for (const tab of sheet.tabs) {
    for (const [msisdn, lines] of tab.duplicates) repeated.set(msisdn, [...(repeated.get(msisdn) ?? []), ...lines.map((n) => `${tab.title} linha ${n}`)]);
    for (const row of tab.rows) {
      const first = where.get(row.msisdn);
      if (first) repeated.set(row.msisdn, [...(repeated.get(row.msisdn) ?? [`${first.tab.title} linha ${first.row.rowNumber}`]), `${tab.title} linha ${row.rowNumber}`]);
      else where.set(row.msisdn, { tab, row });
    }
  }

  let written = 0;
  let failed = 0;
  const giveUp = async (id: string, msg: string) => {
    failed++;
    await sql()`update public.lines set sheet_pending = false, sheet_overwrite = false, sheet_error = ${msg} where id = ${id}`;
  };
  for (const l of pending) {
    const loc = where.get(l.msisdn);
    if (!loc) {
      await giveUp(l.id, "número não encontrado na planilha");
      continue;
    }
    const dup = repeated.get(l.msisdn);
    if (dup) {
      // Não dá para saber qual das linhas é a certa: não escreve nada
      await giveUp(l.id, `o número aparece mais de uma vez na planilha (${[...new Set(dup)].join(", ")}) — deixe só uma e clique em Tentar de novo`);
      continue;
    }
    const { tab, row } = loc;
    const sheetRow = row.rowNumber; // 1-based
    const cells: { range: string; value: string }[] = [];
    const ctx: TemplateContext = {
      cliente: l.customer ?? "", iccid: l.iccid, smart: l.smart_dados,
      ativacao: l.activated_at ? saoPauloIso(l.activated_at) : null,
      vendaCents: l.sale_price_cents, valorCents: l.cost_cents, vencimento: l.due,
      pedido: l.code ? shortOrderNumber(l.code).replace(/^#/, "") : null, plano: l.plan_name,
    };
    // Venda pelo site, ou correção feita pela equipe no painel ("Editar"): preenche as colunas da venda
    if (l.order_id || l.sheet_overwrite) {
      // Sem passar por cima de outro cliente — a não ser que a equipe tenha corrigido no painel
      if (!l.sheet_overwrite && row.kind === "inconsistente") {
        await giveUp(l.id, `na planilha a linha ${row.rowNumber} ${row.problem} — arrume a planilha e clique em Tentar de novo`);
        continue;
      }
      // O nome na planilha pode estar como o modelo da coluna Cliente (ex.: "Beatriz Rocha - pedido 8")
      const naPlanilha = normalizeName(row.cliente ?? "");
      if (
        !l.sheet_overwrite && row.kind === "cliente" && naPlanilha !== normalizeName(l.customer ?? "") &&
        naPlanilha !== normalizeName(expectedClientText(templates.cliente, ctx, sheet.locale))
      ) {
        await giveUp(l.id, `na planilha este número já está com o cliente "${row.cliente}" — confira antes`);
        continue;
      }
      // O que vai em cada coluna: modelo de Configurações (vazio = não escreve nessa coluna)
      for (const f of WRITABLE_FIELDS) {
        const col = tab.map[f];
        const tpl = templates[f];
        if (col === undefined || !tpl) continue;
        cells.push({ range: `${quoteTab(tab.title)}!${columnLetter(col)}${sheetRow}`, value: renderTemplate(tpl, ctx, sheet.locale) });
      }
    }
    // Regras de Configurações (ex.: Gestor → "Gestor Ativo"; nome em vermelho no bloqueio)
    const event = eventForLine({
      status: l.status, orderId: l.order_id, overwrite: l.sheet_overwrite, activatedAt: l.activated_at, reactivatedAt: l.reactivated_at,
    });
    // Correção no painel ("Editar linha") de linha ativa: só as cores da ativação (o estilo copiado
    // da linha vizinha pode vir vermelho), sem mexer nos textos que o gestor já ajustou.
    const colorsOnly = !event && l.sheet_overwrite && l.status === "ativa";
    const ruleRequests: unknown[] = [];
    const active = event ? rules.filter((x) => x.quando === event)
      : colorsOnly ? rules.filter((x) => x.quando === "ativar").map((x) => ({ ...x, escrever: null })) : [];
    for (const r of active) {
      const col = ruleColumnIndex(tab.header, r.coluna, tab.map);
      if (col === -1) continue; // esta aba não tem a coluna: ignora
      if (!ruleConditionMatches(r, tab.values[sheetRow - 1]?.[col])) continue;
      const range = `${quoteTab(tab.title)}!${columnLetter(col)}${sheetRow}`;
      if (r.escrever !== null) {
        const i = cells.findIndex((c) => c.range === range);
        if (i >= 0) cells.splice(i, 1);
        // A regra também aceita etiquetas (ex.: "Ativo [Data de ativação]")
        cells.push({ range, value: renderTemplate(r.escrever, ctx, sheet.locale) });
      }
      if (r.corTexto) ruleRequests.push(sheetRequests.textColor(tab.sheetId, sheetRow - 1, col, colorToRgb(r.corTexto)));
      if (r.corFundo) ruleRequests.push(sheetRequests.backgroundColor(tab.sheetId, sheetRow - 1, col, colorToRgb(r.corFundo)));
    }
    try {
      if (cells.length) await sheets.writeCells(sheet.spreadsheetId, cells);
      const requests: unknown[] = [];
      if (l.order_id || l.sheet_overwrite) {
        // Mesmo estilo das outras linhas: copia a formatação da linha de cliente mais próxima
        const ref = referenceRow(tab, sheetRow);
        if (ref) {
          for (const f of WRITABLE_FIELDS) {
            const col = tab.map[f];
            if (col !== undefined && templates[f]) requests.push(sheetRequests.copyFormat(tab.sheetId, ref - 1, sheetRow - 1, col));
          }
          // Smart-Dados com o trecho numérico colorido como no modelo (ex.: "100+100" em vermelho)
          const smartCol = tab.map.smart;
          const smartText = templates.smart ? renderTemplate(templates.smart, ctx, sheet.locale).replace(/^'/, "") : "";
          if (smartCol !== undefined && smartText) {
            const model = await sheets.cellText(sheet.spreadsheetId, `${quoteTab(tab.title)}!${columnLetter(smartCol)}${ref}`);
            const runs = mirrorTextRuns(smartText, model.text, model.runs);
            if (runs) requests.push(sheetRequests.richText(tab.sheetId, sheetRow - 1, smartCol, smartText, runs));
          }
        }
      }
      // Depois de copiar o estilo, para a regra valer por cima
      requests.push(...ruleRequests);
      if (requests.length) await sheets.batch(sheet.spreadsheetId, requests);
      await sql()`update public.lines set sheet_pending = false, sheet_overwrite = false, sheet_error = null, sheet_synced_at = now() where id = ${l.id}`;
      written++;
    } catch (err) {
      failed++;
      const msg = sheetErrorMessage(err);
      await sql()`update public.lines set sheet_error = ${msg} where id = ${l.id}`; // continua pendente: a rotina tenta de novo
      if (err instanceof SheetsError && [401, 403, 404].includes(err.status)) break;
    }
  }
  return { written, failed };
}

/** Linha de cliente mais próxima (de preferência com Smart-Dados) para servir de modelo de estilo. */
function referenceRow(tab: TabData, target: number): number | null {
  const candidates = tab.rows.filter((r) => r.kind === "cliente" && r.rowNumber !== target);
  const pool = candidates.some((r) => r.smart) ? candidates.filter((r) => r.smart) : candidates;
  let best: number | null = null;
  for (const r of pool) if (best === null || Math.abs(r.rowNumber - target) < Math.abs(best - target)) best = r.rowNumber;
  return best;
}

function saoPauloIso(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export async function sheetQueueCounts() {
  const [r] = await sql()<{ pending: number; errors: number }[]>`
    select count(*) filter (where sheet_pending)::int as pending,
           count(*) filter (where sheet_error is not null)::int as errors
    from public.lines`;
  return r;
}

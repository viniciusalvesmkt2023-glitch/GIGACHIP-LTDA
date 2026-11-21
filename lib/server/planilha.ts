import "server-only";
import { normalizeName } from "@/lib/domain/inadimplencia";
import {
  columnLetter,
  FIELD_LABEL,
  findHeader,
  formatForSheet,
  isAvailableMarker,
  parseSheetRows,
  quoteTab,
  WRITABLE_FIELDS,
  type ColumnMap,
  type SheetField,
  type SheetRow,
} from "@/lib/domain/planilha";
import { sheets, sheetsConfigured, SheetsError } from "@/lib/integrations/google/sheets";
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
const RED = { red: 0.8, green: 0, blue: 0 };
const BLACK = { red: 0, green: 0, blue: 0 };

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

export async function sheetEnabled(): Promise<boolean> {
  return sheetsConfigured() && (await getSheetConfig()) !== null;
}

type TabData = {
  title: string; sheetId: number; headerIndex: number; map: ColumnMap; rows: SheetRow[]; invalid: number[]; duplicates: Map<string, number[]>;
};

/** Lê todas as abas (ou só a configurada) que têm um cabeçalho com a coluna "Número". */
export async function readSheet() {
  const cfg = await getSheetConfig();
  if (!cfg) throw new Error("Link da planilha não configurado (Configurações)");
  const meta = await sheets.meta(cfg.spreadsheetId);
  const wanted = cfg.tab ? meta.sheets.filter((s) => s.properties.title === cfg.tab) : meta.sheets;
  if (cfg.tab && !wanted.length) throw new Error(`Aba "${cfg.tab}" não encontrada na planilha`);
  const tabs: TabData[] = [];
  for (const s of wanted) {
    const { values = [] } = await sheets.values(cfg.spreadsheetId, `${quoteTab(s.properties.title)}!A1:AZ5000`);
    const header = findHeader(values);
    if (!header) continue;
    const parsed = parseSheetRows(values, header);
    tabs.push({ title: s.properties.title, sheetId: s.properties.sheetId, headerIndex: header.index, map: header.map, ...parsed });
  }
  return { spreadsheetId: cfg.spreadsheetId, title: meta.properties.title, locale: meta.properties.locale ?? "pt_BR", tabs };
}

/** Teste do painel: mostra o que o sistema entendeu da planilha, sem escrever nada. */
export async function describeSheet() {
  const s = await readSheet();
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
  const pending = await sql()<
    {
      id: string; msisdn: string; status: string; order_id: string | null; customer: string | null; iccid: string | null;
      smart_dados: string | null; activated_at: Date | null; sale_price_cents: number | null; cost_cents: number | null; due: string | null;
    }[]
  >`
    select l.id, l.msisdn, l.status::text, l.order_id, coalesce(c.full_name, l.legacy_customer_name) as customer, l.iccid,
           l.smart_dados, l.activated_at, l.sale_price_cents, l.cost_cents, coalesce(s.next_due_date, l.legacy_due_date)::text as due
    from public.lines l
    left join public.orders o on o.id = l.order_id
    left join public.customers c on c.id = o.customer_id
    left join public.subscriptions s on s.order_id = o.id
    where l.sheet_pending
    order by l.updated_at limit ${limit}`;
  if (!pending.length) return { written: 0, failed: 0 };

  let sheet: Awaited<ReturnType<typeof readSheet>>;
  try {
    sheet = await readSheet();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
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
    await sql()`update public.lines set sheet_pending = false, sheet_error = ${msg} where id = ${id}`;
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
    if (l.order_id) {
      // Venda pelo site: preenche as colunas da venda, sem passar por cima de outro cliente
      if (row.kind === "inconsistente") {
        await giveUp(l.id, `na planilha a linha ${row.rowNumber} ${row.problem} — arrume a planilha e clique em Tentar de novo`);
        continue;
      }
      if (row.kind === "cliente" && normalizeName(row.cliente ?? "") !== normalizeName(l.customer ?? "")) {
        await giveUp(l.id, `na planilha este número já está com o cliente "${row.cliente}" — confira antes`);
        continue;
      }
      const values = {
        cliente: l.customer ?? "", iccid: l.iccid, smart: l.smart_dados,
        ativacao: l.activated_at ? saoPauloIso(l.activated_at) : null,
        vendaCents: l.sale_price_cents, valorCents: l.cost_cents, vencimento: l.due,
      };
      for (const f of WRITABLE_FIELDS) {
        const col = tab.map[f];
        if (col === undefined) continue;
        cells.push({ range: `${quoteTab(tab.title)}!${columnLetter(col)}${sheetRow}`, value: formatForSheet(f, values, sheet.locale) });
      }
    }
    try {
      if (cells.length) await sheets.writeCells(sheet.spreadsheetId, cells);
      if (tab.map.cliente !== undefined) {
        const blocked = ["suspensa", "suspensao_pendente"].includes(l.status);
        await sheets.setTextColor(sheet.spreadsheetId, [{ sheetId: tab.sheetId, row: sheetRow - 1, column: tab.map.cliente, color: blocked ? RED : BLACK }]);
      }
      await sql()`update public.lines set sheet_pending = false, sheet_error = null, sheet_synced_at = now() where id = ${l.id}`;
      written++;
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      await sql()`update public.lines set sheet_error = ${msg} where id = ${l.id}`; // continua pendente: a rotina tenta de novo
      if (err instanceof SheetsError && [401, 403, 404].includes(err.status)) break;
    }
  }
  return { written, failed };
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

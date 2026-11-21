import "server-only";
import { paymentMethodText, smartDadosText, type NewNumberRow } from "@/lib/domain/lines";
import { decryptField } from "./crypto";
import { sql, withActor } from "./db";
import { env } from "./env";
import type { Staff } from "./staff-auth";

/** Estoque de linhas e ativação (D26) — substitui a planilha de controle. */

const COST_KEY = "custo_linha_gestor_cents";
const DEFAULT_COST_CENTS = 3000;

export async function getLineCostCents(): Promise<number> {
  const [row] = await sql()<{ value: unknown }[]>`select value from public.app_settings where key = ${COST_KEY}`;
  const n = Number(row?.value);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_COST_CENTS;
}

export async function setLineCostCents(staff: Staff, cents: number): Promise<void> {
  const before = await getLineCostCents();
  await sql()`
    insert into public.app_settings (key, value, updated_by, updated_at)
    values (${COST_KEY}, ${sql().json(cents)}, ${staff.id}, now())
    on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`;
  await sql()`
    insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
    values (${staff.id}, 'alterar_valor_gestor', 'app_settings', ${COST_KEY}, ${sql().json({ de: before, para: cents })})`;
}

export type LineRow = {
  id: string;
  status: string;
  customer: string | null;
  vivoLogin: string | null;
  msisdn: string;
  iccid: string | null;
  smartDados: string | null;
  planoPj: string | null;
  activatedAt: Date | null;
  salePriceCents: number | null;
  costCents: number | null;
  dueDate: string | null;
  paymentMethod: string | null;
  orderId: string | null;
  orderCode: string | null;
  sheetPending: boolean;
  sheetError: string | null;
  sheetRow: number | null;
  sheetGid: number | null;
  sheetTab: string | null;
};

export async function listLines(filter: { status?: string; q?: string }): Promise<LineRow[]> {
  const status = filter.status || null;
  const q = filter.q?.trim() ? `%${filter.q.trim()}%` : null;
  const rows = await sql()<
    {
      id: string; status: string; customer: string | null; vivo_login: string | null; msisdn: string; iccid: string | null;
      smart_dados: string | null; plano_pj: string | null; activated_at: Date | null; sale_price_cents: number | null;
      cost_cents: number | null; due_date: string | null; payment_method: string | null; order_id: string | null; code: string | null;
      sheet_pending: boolean; sheet_error: string | null; sheet_row: number | null; sheet_gid: number | null; sheet_tab: string | null;
    }[]
  >`
    select l.id, l.status::text, coalesce(c.full_name, l.legacy_customer_name) as customer, l.vivo_login, l.msisdn, l.iccid,
           l.smart_dados, l.plano_pj, l.activated_at, l.sale_price_cents, l.cost_cents,
           coalesce(s.next_due_date, l.legacy_due_date)::text as due_date, l.payment_method, l.order_id, o.code,
           l.sheet_pending, l.sheet_error, l.sheet_row, l.sheet_gid, l.sheet_tab
    from public.lines l
    left join public.orders o on o.id = l.order_id
    left join public.customers c on c.id = o.customer_id
    left join public.subscriptions s on s.order_id = o.id
    where (${status}::text is null or l.status::text = ${status})
      and (${q}::text is null or l.msisdn ilike ${q} or l.iccid ilike ${q}
           or coalesce(c.full_name, l.legacy_customer_name, '') ilike ${q} or coalesce(o.code, '') ilike ${q})
    -- Mesma ordem da planilha do gestor; o que não está nela (ex.: cadastrado à mão) vem no fim
    order by l.sheet_tab nulls last, l.sheet_row nulls last, (l.status = 'disponivel') desc, l.activated_at desc nulls last, l.msisdn
    limit 500`;
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    customer: r.customer,
    vivoLogin: r.vivo_login,
    msisdn: r.msisdn,
    iccid: r.iccid,
    smartDados: r.smart_dados,
    planoPj: r.plano_pj,
    activatedAt: r.activated_at,
    salePriceCents: r.sale_price_cents,
    costCents: r.cost_cents,
    dueDate: r.due_date,
    paymentMethod: r.payment_method,
    orderId: r.order_id,
    orderCode: r.code,
    sheetPending: r.sheet_pending,
    sheetError: r.sheet_error,
    sheetRow: r.sheet_row,
    sheetGid: r.sheet_gid,
    sheetTab: r.sheet_tab,
  }));
}

export async function lineCounts() {
  const rows = await sql()<{ status: string; n: number }[]>`select status::text, count(*)::int as n from public.lines group by status`;
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Record<string, number>;
}

export async function addAvailableNumbers(staff: Staff, rows: NewNumberRow[]): Promise<{ added: number; duplicated: string[] }> {
  let added = 0;
  const duplicated: string[] = [];
  for (const r of rows) {
    const res = await sql()`
      insert into public.lines (msisdn, status, vivo_login, plano_pj)
      values (${r.msisdn}, 'disponivel', ${r.vivoLogin}, ${r.planoPj})
      on conflict (msisdn) do nothing
      returning id`;
    if (res.length) added++;
    else duplicated.push(r.msisdn);
  }
  await sql()`
    insert into public.audit_log (actor_id, action, entity, metadata)
    values (${staff.id}, 'adicionar_numeros_estoque', 'lines', ${sql().json({ adicionados: added, repetidos: duplicated.length })})`;
  return { added, duplicated };
}

export async function availableNumbers() {
  return sql()<{ id: string; msisdn: string; plano_pj: string | null; vivo_login: string | null }[]>`
    select id, msisdn, plano_pj, vivo_login from public.lines
    where status = 'disponivel' and order_id is null
    order by msisdn`;
}

/** Valores que o sistema já sabe para preencher a ativação (o dono só confere e digita o ICCID). */
export async function activationDefaults(orderId: string) {
  const [o] = await sql()<
    {
      status: string; sim_type: string; full_name: string; plan: { dataBaseGb: number; dataBonusGb: number; name: string };
      monthly_price_cents: number; next_due_date: string | null; billing_type: string | null; iccid_enc: Uint8Array | null; line_id: string | null;
    }[]
  >`
    select o.status::text, o.sim_type::text, c.full_name, o.plan_snapshot as plan, o.monthly_price_cents,
           s.next_due_date::text as next_due_date, s.billing_type::text as billing_type, d.iccid_encrypted as iccid_enc,
           (select id from public.lines where order_id = o.id) as line_id
    from public.orders o
    join public.customers c on c.id = o.customer_id
    left join public.subscriptions s on s.order_id = o.id
    left join public.device_info d on d.order_id = o.id
    where o.id = ${orderId}`;
  if (!o) return null;
  return {
    status: o.status,
    alreadyActivated: Boolean(o.line_id),
    customer: o.full_name,
    planName: o.plan.name,
    smartDados: smartDadosText(o.plan.dataBaseGb, o.plan.dataBonusGb),
    salePriceCents: o.monthly_price_cents,
    costCents: await getLineCostCents(),
    nextDueDate: o.next_due_date,
    paymentMethod: paymentMethodText(o.billing_type),
    // Chip físico: o ICCID que o cliente informou já vem preenchido (o dono confere)
    iccidSuggestion: o.sim_type === "physical" && o.iccid_enc ? decryptField(o.iccid_enc, env().FIELD_ENCRYPTION_KEY) : "",
  };
}

export type ActivateInput = { lineId: string; iccid: string; smartDados: string; salePriceCents: number; costCents: number };

/** Ativação: vincula o número do estoque ao pedido e preenche as colunas da "planilha". */
export async function activateOrder(staff: Staff, orderId: string, input: ActivateInput): Promise<{ ok: boolean; message: string }> {
  const iccid = input.iccid.replace(/\s/g, "");
  if (!/^\d{18,22}$/.test(iccid)) return { ok: false, message: "ICCID inválido: digite os números do chip (18 a 22 dígitos)." };
  const defaults = await activationDefaults(orderId);
  if (!defaults) return { ok: false, message: "Pedido não encontrado." };

  return withActor({ type: "staff", id: staff.id, reason: "linha ativada na Vivo" }, async (tx) => {
    const [order] = await tx<{ status: string }[]>`select status::text from public.orders where id = ${orderId} for update`;
    if (!order || !["pronto_para_ativacao", "em_ativacao"].includes(order.status)) {
      return { ok: false, message: "O pedido não está pronto para ativação." };
    }
    const [line] = await tx<{ id: string }[]>`
      select id from public.lines where id = ${input.lineId} and status = 'disponivel' and order_id is null for update`;
    if (!line) return { ok: false, message: "Esse número não está mais disponível. Escolha outro." };

    // Só os campos da VENDA são preenchidos. O que já veio cadastrado com o número
    // (login Vivo, número, plano PJ, forma de pagamento) nunca é alterado aqui.
    await tx`
      update public.lines
      set order_id = ${orderId}, status = 'ativa', iccid = ${iccid}, smart_dados = ${input.smartDados},
          sale_price_cents = ${input.salePriceCents}, cost_cents = ${input.costCents},
          payment_method = coalesce(payment_method, ${defaults.paymentMethod}),
          activated_by = ${staff.id}, activated_at = now(), sheet_pending = true, sheet_error = null
      where id = ${line.id}`;
    await tx`update public.orders set status = 'ativado', assigned_to = ${staff.id} where id = ${orderId}`;
    await tx`
      insert into public.notifications (order_id, customer_id, channel, template, dedupe_key)
      select o.id, o.customer_id, 'email', 'linha_ativada', ${`linha_ativada:${orderId}`}
      from public.orders o where o.id = ${orderId}
      on conflict (dedupe_key) do nothing`;
    return { ok: true, message: "Linha ativada! O cliente será avisado." };
  });
}

/** Linha ligada a um pedido (card "Linha" no pedido). */
export async function lineForOrder(orderId: string) {
  const [l] = await sql()<{
    id: string; msisdn: string; iccid: string | null; status: string; activated_at: Date | null;
    sheet_pending: boolean; sheet_error: string | null; sheet_synced_at: Date | null;
  }[]>`
    select id, msisdn, iccid, status::text, activated_at, sheet_pending, sheet_error, sheet_synced_at
    from public.lines where order_id = ${orderId}`;
  return l ?? null;
}

export async function linesCsv(): Promise<string> {
  const { csvCell, formatMsisdn } = await import("@/lib/domain/lines");
  const rows = await listLines({});
  const money = (c: number | null) => (c === null ? "" : (c / 100).toFixed(2).replace(".", ","));
  const date = (d: Date | string | null) => {
    if (!d) return "";
    const iso = typeof d === "string" ? d : new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
    const [y, m, day] = iso.slice(0, 10).split("-");
    return `${day}/${m}/${y}`;
  };
  const header = ["Linha na planilha", "Cliente Ativos", "Loguin Vivo Gestão", "Número", "ICCID Atual", "Smart-Dados", "Plano PJ", "Ativação", "Venda Final", "Valor", "Vencimento", "Forma de Pagamento", "Situação", "Pedido"];
  const lines = rows.map((r) =>
    [
      r.sheetRow,
      r.status === "disponivel" ? "Disponível" : r.customer,
      r.vivoLogin,
      formatMsisdn(r.msisdn).replace(/\D/g, ""),
      r.iccid,
      r.smartDados,
      r.planoPj,
      date(r.activatedAt),
      money(r.salePriceCents),
      money(r.costCents),
      date(r.dueDate),
      r.paymentMethod,
      r.status,
      r.orderCode,
    ].map(csvCell).join(";"),
  );
  // BOM para o Excel abrir acentos corretamente
  return "﻿" + [header.map(csvCell).join(";"), ...lines].join("\r\n");
}

// ------------------------------------------------------------------ editar linha (painel)

export type LineDetail = {
  id: string;
  msisdn: string;
  status: string;
  orderId: string | null;
  orderCode: string | null;
  customer: string | null;
  vivoLogin: string | null;
  planoPj: string | null;
  paymentMethod: string | null;
  iccid: string | null;
  smartDados: string | null;
  activatedOn: string | null; // YYYY-MM-DD (São Paulo)
  salePriceCents: number | null;
  costCents: number | null;
  dueDate: string | null; // YYYY-MM-DD
  notes: string | null;
  sheetRow: number | null;
  sheetPending: boolean;
  sheetError: string | null;
};

export async function getLine(id: string): Promise<LineDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [r] = await sql()<{
    id: string; msisdn: string; status: string; order_id: string | null; code: string | null; customer: string | null;
    vivo_login: string | null; plano_pj: string | null; payment_method: string | null; iccid: string | null; smart_dados: string | null;
    activated_on: string | null; sale_price_cents: number | null; cost_cents: number | null; due: string | null; notes: string | null;
    sheet_row: number | null; sheet_pending: boolean; sheet_error: string | null;
  }[]>`
    select l.id, l.msisdn, l.status::text, l.order_id, o.code, coalesce(c.full_name, l.legacy_customer_name) as customer,
           l.vivo_login, l.plano_pj, l.payment_method, l.iccid, l.smart_dados,
           (l.activated_at at time zone 'America/Sao_Paulo')::date::text as activated_on,
           l.sale_price_cents, l.cost_cents, coalesce(s.next_due_date, l.legacy_due_date)::text as due, l.notes, l.sheet_row,
           l.sheet_pending, l.sheet_error
    from public.lines l
    left join public.orders o on o.id = l.order_id
    left join public.customers c on c.id = o.customer_id
    left join public.subscriptions s on s.order_id = o.id
    where l.id = ${id}`;
  if (!r) return null;
  return {
    id: r.id, msisdn: r.msisdn, status: r.status, orderId: r.order_id, orderCode: r.code, customer: r.customer,
    vivoLogin: r.vivo_login, planoPj: r.plano_pj, paymentMethod: r.payment_method, iccid: r.iccid, smartDados: r.smart_dados,
    activatedOn: r.activated_on, salePriceCents: r.sale_price_cents, costCents: r.cost_cents, dueDate: r.due, notes: r.notes,
    sheetRow: r.sheet_row, sheetPending: r.sheet_pending, sheetError: r.sheet_error,
  };
}

export type LineEdit = {
  customer: string | null; // só linhas antigas (sem pedido): o nome do cliente do site vem do cadastro
  iccid: string | null;
  smartDados: string | null;
  activatedOn: string | null;
  salePriceCents: number | null;
  costCents: number | null;
  dueDate: string | null; // só linhas antigas: nas do site o vencimento vem da assinatura do Asaas
  notes: string | null;
};

/**
 * Correção feita pela equipe. Com a planilha ligada, a correção também vai para a planilha
 * (Cliente, ICCID, Smart-Dados, Ativação, Venda final, Valor, Vencimento), passando por cima do
 * que estiver lá. Login, Número, Plano PJ e Forma de pagamento são do gestor (só na planilha).
 */
export async function updateLine(staff: Staff, id: string, e: LineEdit, writeToSheet: boolean): Promise<{ ok: boolean; message: string }> {
  const cur = await getLine(id);
  if (!cur) return { ok: false, message: "Linha não encontrada." };
  if (cur.status === "disponivel") return { ok: false, message: "Número disponível: para vender, use “Ativar linha” no pedido." };
  if (e.iccid && !/^\d{18,22}$/.test(e.iccid)) return { ok: false, message: "ICCID inválido: 18 a 22 números." };
  const legacy = !cur.orderId;
  if (legacy && !e.customer?.trim()) return { ok: false, message: "Informe o nome do cliente." };

  const changed: string[] = [];
  const diff = (name: string, a: unknown, b: unknown) => { if ((a ?? null) !== (b ?? null)) changed.push(name); };
  if (legacy) diff("cliente", cur.customer, e.customer?.trim());
  diff("iccid", cur.iccid, e.iccid);
  diff("smart_dados", cur.smartDados, e.smartDados);
  diff("ativacao", cur.activatedOn, e.activatedOn);
  diff("venda_final", cur.salePriceCents, e.salePriceCents);
  diff("valor_gestor", cur.costCents, e.costCents);
  if (legacy) diff("vencimento", cur.dueDate, e.dueDate);
  diff("observacoes", cur.notes, e.notes);
  if (!changed.length) return { ok: true, message: "Nada mudou." };
  const sheetFields = changed.filter((c) => c !== "observacoes");

  await withActor({ type: "staff", id: staff.id, reason: "linha corrigida no painel" }, async (tx) => {
    await tx`
      update public.lines
      set legacy_customer_name = case when order_id is null then ${e.customer?.trim() ?? null} else legacy_customer_name end,
          legacy_due_date = case when order_id is null then ${e.dueDate}::date else legacy_due_date end,
          iccid = ${e.iccid}, smart_dados = ${e.smartDados},
          activated_at = ${e.activatedOn ? `${e.activatedOn} 12:00:00-03` : null},
          sale_price_cents = ${e.salePriceCents}, cost_cents = ${e.costCents}, notes = ${e.notes},
          sheet_pending = sheet_pending or ${writeToSheet && sheetFields.length > 0},
          sheet_overwrite = sheet_overwrite or ${writeToSheet && sheetFields.length > 0},
          sheet_error = case when ${writeToSheet && sheetFields.length > 0} then null else sheet_error end
      where id = ${id}`;
    // Só os nomes dos campos (sem valores: ICCID não vai para o histórico)
    await tx`
      insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
      values (${staff.id}, 'editar_linha', 'lines', ${id}, ${tx.json({ campos: changed })})`;
  });
  return {
    ok: true,
    message: writeToSheet && sheetFields.length ? "Salvo. A planilha do gestor está sendo atualizada." : "Salvo.",
  };
}

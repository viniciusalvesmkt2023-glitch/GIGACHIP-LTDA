import "server-only";
import { todayInSaoPaulo } from "@/lib/domain/billing";
import { customerSituation, daysBetween, daysLate, normalizeName, overdueStateFromAsaas } from "@/lib/domain/inadimplencia";
import { parseDate } from "@/lib/domain/billing";
import { asaas, AsaasError, type AsaasPayment } from "@/lib/integrations/asaas/client";
import { reaisToCents } from "@/lib/integrations/asaas/mapping";
import { sql, withActor } from "./db";
import type { Staff } from "./staff-auth";

/**
 * Inadimplência (D29). Fonte da verdade: as cobranças do Asaas (todos os clientes da conta,
 * inclusive os antigos da planilha). Bloquear/desbloquear é manual na Vivo; aqui só registramos.
 */

const SYNC_KEY = "inadimplencia_sincronizada_em";
const SYNC_EVERY_MINUTES = 55;
const MAX_PAGES = 20; // 20 × 100 cobranças vencidas
const MAX_RECHECKS = 100;

async function customerName(customerId: string, cache: Map<string, string>): Promise<string> {
  const hit = cache.get(customerId);
  if (hit) return hit;
  const [known] = await sql()<{ name: string }[]>`
    select customer_name as name from public.overdue_payments where provider_customer_id = ${customerId}
    union all
    select customer_name from public.line_blocks where provider_customer_id = ${customerId}
    limit 1`;
  const name = known?.name ?? (await asaas.getCustomer(customerId)).name ?? "(sem nome no Asaas)";
  cache.set(customerId, name);
  return name;
}

/** Atualiza o espelho de uma cobrança do Asaas. Chamado pela rotina e pelo webhook. */
export async function trackAsaasPayment(p: AsaasPayment, cache = new Map<string, string>()): Promise<void> {
  const state = overdueStateFromAsaas(p.status, p.deleted === true);
  if (!state) return;
  if (state === "em_aberto" && (await isUnpaidSiteOrder(p))) {
    // Pedido do site que nunca foi pago (desistiu no PIX): não existe linha para bloquear
    await sql()`update public.overdue_payments set status = 'sem_atraso', checked_at = now() where provider_payment_id = ${p.id}`;
    return;
  }
  if (state === "em_aberto") {
    const name = await customerName(p.customer, cache);
    await sql()`
      insert into public.overdue_payments
        (provider_payment_id, provider_customer_id, customer_name, value_cents, due_date, invoice_url, status)
      values (${p.id}, ${p.customer}, ${name}, ${reaisToCents(p.value)}, ${p.dueDate}, ${p.invoiceUrl ?? null}, 'em_aberto')
      on conflict (provider_payment_id) do update
        set status = 'em_aberto', value_cents = excluded.value_cents, due_date = excluded.due_date,
            invoice_url = excluded.invoice_url, paid_at = null, checked_at = now()`;
    return;
  }
  await sql()`
    update public.overdue_payments
    set status = ${state}, checked_at = now(),
        paid_at = case when ${state} = 'pago' then coalesce(paid_at, now()) else paid_at end
    where provider_payment_id = ${p.id}`;
}

/** 1ª mensalidade de um pedido do site, ou cobrança de um pedido que nunca chegou a ser pago. */
async function isUnpaidSiteOrder(p: AsaasPayment): Promise<boolean> {
  const [r] = await sql()<{ skip: boolean }[]>`
    select exists (select 1 from public.payments where provider_payment_id = ${p.id} and is_first_payment)
        or exists (
          select 1 from public.subscriptions s join public.orders o on o.id = s.order_id
          where s.provider_subscription_id = ${p.subscription ?? ""}
            and o.status in ('rascunho', 'aguardando_pagamento', 'expirado', 'cancelado')) as skip`;
  return r.skip;
}

/** Puxa do Asaas as cobranças vencidas e confere as que saíram da lista. */
export async function syncOverdue(opts: { force?: boolean } = {}) {
  if (!opts.force) {
    const [row] = await sql()<{ value: unknown }[]>`select value from public.app_settings where key = ${SYNC_KEY}`;
    const last = typeof row?.value === "string" ? new Date(row.value) : null;
    if (last && Date.now() - last.getTime() < SYNC_EVERY_MINUTES * 60_000) return { skipped: true as const };
  }
  const started = new Date();
  await sql()`
    insert into public.app_settings (key, value, updated_at) values (${SYNC_KEY}, ${sql().json(started.toISOString())}, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()`;

  const cache = new Map<string, string>();
  let overdue = 0;
  for (let page = 0, offset = 0; page < MAX_PAGES; page++) {
    const r = await asaas.listPaymentsByStatus("OVERDUE", offset, 100);
    for (const p of r.data) {
      await trackAsaasPayment(p, cache);
      overdue++;
    }
    if (!r.hasMore || r.data.length === 0) break;
    offset += r.data.length;
  }

  // Estavam em atraso e não vieram na lista: pagou, foi removida ou mudou o vencimento
  const stale = await sql()<{ id: string }[]>`
    select provider_payment_id as id from public.overdue_payments
    where status = 'em_aberto' and checked_at < ${started}
    order by checked_at limit ${MAX_RECHECKS}`;
  for (const { id } of stale) {
    try {
      await trackAsaasPayment(await asaas.getPayment(id), cache);
    } catch (err) {
      if (err instanceof AsaasError && err.status === 404) {
        await sql()`update public.overdue_payments set status = 'sem_atraso', checked_at = now() where provider_payment_id = ${id}`;
      } else {
        console.error(`[inadimplencia] não foi possível conferir a cobrança: ${err instanceof Error ? err.message : err}`);
      }
    }
  }
  return { skipped: false as const, overdue, rechecked: stale.length };
}

export async function lastOverdueSync(): Promise<Date | null> {
  const [row] = await sql()<{ value: unknown }[]>`select value from public.app_settings where key = ${SYNC_KEY}`;
  return typeof row?.value === "string" ? new Date(row.value) : null;
}

export type OverdueItem = { id: string; valueCents: number; due: string; daysLate: number; invoiceUrl: string | null };
export type BoardLine = { id: string; msisdn: string; vivoLogin: string | null };
export type BoardRow = {
  customerId: string;
  name: string;
  items: OverdueItem[];
  totalCents: number;
  maxDaysLate: number;
  lines: BoardLine[];
  suggestedLineId: string | null;
  blockId: string | null;
  blockedAt: Date | null;
  blockedDays: number | null;
  paidAt: Date | null;
};
export type LinkableLine = { id: string; msisdn: string; name: string | null };

/** Listas do painel: bloquear, bloqueados (aguardando pagamento) e desbloquear. */
export async function overdueBoard() {
  const today = todayInSaoPaulo();
  const rows = await sql()<
    {
      customer_id: string; name: string; items: { id: string; value: number; due: string; url: string | null }[];
      block_id: string | null; blocked_at: Date | null; block_line_id: string | null; paid_at: Date | null;
    }[]
  >`
    with debt as (
      select provider_customer_id, max(customer_name) as name,
             json_agg(json_build_object('id', provider_payment_id, 'value', value_cents, 'due', due_date::text, 'url', invoice_url)
                      order by due_date) as items
      from public.overdue_payments where status = 'em_aberto' group by provider_customer_id
    ), blk as (
      select * from public.line_blocks where unblocked_at is null
    )
    select coalesce(d.provider_customer_id, b.provider_customer_id) as customer_id,
           coalesce(d.name, b.customer_name) as name,
           coalesce(d.items, '[]'::json) as items,
           b.id as block_id, b.blocked_at, b.line_id as block_line_id,
           (select max(paid_at) from public.overdue_payments p
             where p.provider_customer_id = coalesce(d.provider_customer_id, b.provider_customer_id) and p.status = 'pago') as paid_at
    from debt d full join blk b on b.provider_customer_id = d.provider_customer_id
    order by name`;

  const ids = rows.map((r) => r.customer_id);
  const lineRows = ids.length
    ? await sql()<{ id: string; msisdn: string; vivo_login: string | null; customer_id: string }[]>`
        select l.id, l.msisdn, l.vivo_login, coalesce(l.asaas_customer_id, s.provider_customer_id) as customer_id
        from public.lines l
        left join public.subscriptions s on s.order_id = l.order_id
        where l.asaas_customer_id = any(${ids}) or s.provider_customer_id = any(${ids})`
    : [];
  // Linhas antigas (planilha) ainda sem cliente do Asaas: para ligar na hora de bloquear
  const linkable = await sql()<{ id: string; msisdn: string; name: string | null }[]>`
    select id, msisdn, legacy_customer_name as name from public.lines
    where order_id is null and asaas_customer_id is null and status not in ('disponivel', 'cancelada')
    order by legacy_customer_name nulls last, msisdn`;

  const board = { bloquear: [] as BoardRow[], bloqueado: [] as BoardRow[], desbloquear: [] as BoardRow[] };
  for (const r of rows) {
    const items: OverdueItem[] = r.items.map((i) => ({
      id: i.id, valueCents: i.value, due: i.due, daysLate: daysLate(i.due, today), invoiceUrl: i.url,
    }));
    const lines = lineRows.filter((l) => l.customer_id === r.customer_id).map((l) => ({ id: l.id, msisdn: l.msisdn, vivoLogin: l.vivo_login }));
    const wanted = normalizeName(r.name);
    const row: BoardRow = {
      customerId: r.customer_id,
      name: r.name,
      items,
      totalCents: items.reduce((s, i) => s + i.valueCents, 0),
      maxDaysLate: Math.max(0, ...items.map((i) => i.daysLate)),
      lines,
      suggestedLineId: lines.length ? null : linkable.find((l) => l.name && normalizeName(l.name) === wanted)?.id ?? null,
      blockId: r.block_id,
      blockedAt: r.blocked_at,
      blockedDays: r.blocked_at ? daysBetween(parseDate(saoPauloIso(r.blocked_at)), today) : null,
      paidAt: r.paid_at,
    };
    const situation = customerSituation(items.length, Boolean(r.block_id));
    if (situation !== "em_dia") board[situation].push(row);
  }
  board.bloquear.sort((a, b) => b.maxDaysLate - a.maxDaysLate);
  board.bloqueado.sort((a, b) => (b.blockedDays ?? 0) - (a.blockedDays ?? 0));
  return { ...board, linkable: linkable as LinkableLine[] };
}

export async function overdueCounts(): Promise<{ bloquear: number; desbloquear: number }> {
  const [r] = await sql()<{ bloquear: number; desbloquear: number }[]>`
    select
      (select count(distinct p.provider_customer_id)::int from public.overdue_payments p
        where p.status = 'em_aberto'
          and not exists (select 1 from public.line_blocks b where b.provider_customer_id = p.provider_customer_id and b.unblocked_at is null)) as bloquear,
      (select count(*)::int from public.line_blocks b
        where b.unblocked_at is null
          and not exists (select 1 from public.overdue_payments p where p.provider_customer_id = b.provider_customer_id and p.status = 'em_aberto')) as desbloquear`;
  return r;
}

function saoPauloIso(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

type Result = { ok: boolean; message: string };

/** "Bloqueei na Vivo": registra o bloqueio e marca as linhas do cliente como bloqueadas. */
export async function blockCustomer(staff: Staff, customerId: string, lineId: string | null): Promise<Result> {
  return withActor({ type: "staff", id: staff.id, reason: "linha bloqueada na Vivo (sem pagamento)" }, async (tx) => {
    const [debt] = await tx<{ name: string | null; n: number }[]>`
      select max(customer_name) as name, count(*)::int as n from public.overdue_payments
      where provider_customer_id = ${customerId} and status = 'em_aberto'`;
    if (!debt?.n) return { ok: false, message: "Esse cliente não tem cobrança em atraso (talvez já tenha pago). Atualize a página." };
    const [open] = await tx`select 1 from public.line_blocks where provider_customer_id = ${customerId} and unblocked_at is null`;
    if (open) return { ok: false, message: "Esse cliente já está marcado como bloqueado." };

    if (lineId) {
      // Liga a linha da planilha ao cliente do Asaas (só se ainda não estiver ligada a outro)
      const linked = await tx`
        update public.lines set asaas_customer_id = ${customerId}
        where id = ${lineId} and (asaas_customer_id is null or asaas_customer_id = ${customerId}) returning id`;
      if (!linked.length) return { ok: false, message: "Essa linha já está ligada a outro cliente." };
    }
    const [block] = await tx<{ id: string }[]>`
      insert into public.line_blocks (provider_customer_id, customer_name, line_id, blocked_by)
      values (${customerId}, ${debt.name ?? ""}, ${lineId}, ${staff.id}) returning id`;
    const lines = await tx<{ id: string }[]>`
      update public.lines l set status = 'suspensa', suspended_at = now()
      where l.status in ('ativa', 'suspensao_pendente')
        and (l.asaas_customer_id = ${customerId}
             or l.order_id in (select order_id from public.subscriptions where provider_customer_id = ${customerId}))
      returning l.id`;
    await tx`
      insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
      values (${staff.id}, 'bloquear_linha', 'line_blocks', ${block.id}, ${tx.json({ linhas: lines.map((l) => l.id) })})`;
    return { ok: true, message: lines.length ? "Bloqueio registrado. A linha aparece como Bloqueada." : "Bloqueio registrado." };
  });
}

/** "Desbloqueei na Vivo": só depois que o cliente pagou tudo o que estava em atraso. */
export async function unblockCustomer(staff: Staff, blockId: string): Promise<Result> {
  return withActor({ type: "staff", id: staff.id, reason: "linha desbloqueada na Vivo (pagou)" }, async (tx) => {
    const [b] = await tx<{ customer_id: string }[]>`
      select provider_customer_id as customer_id from public.line_blocks where id = ${blockId} and unblocked_at is null for update`;
    if (!b) return { ok: false, message: "Esse bloqueio já foi encerrado. Atualize a página." };
    const [debt] = await tx<{ n: number }[]>`
      select count(*)::int as n from public.overdue_payments where provider_customer_id = ${b.customer_id} and status = 'em_aberto'`;
    if (debt.n > 0) return { ok: false, message: "O cliente ainda tem cobrança em atraso no Asaas." };
    await tx`update public.line_blocks set unblocked_at = now(), unblocked_by = ${staff.id} where id = ${blockId}`;
    const lines = await tx<{ id: string }[]>`
      update public.lines l set status = 'ativa', reactivated_at = now()
      where l.status in ('suspensa', 'reativacao_pendente')
        and (l.asaas_customer_id = ${b.customer_id}
             or l.order_id in (select order_id from public.subscriptions where provider_customer_id = ${b.customer_id}))
      returning l.id`;
    await tx`
      insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
      values (${staff.id}, 'desbloquear_linha', 'line_blocks', ${blockId}, ${tx.json({ linhas: lines.map((l) => l.id) })})`;
    return { ok: true, message: "Desbloqueio registrado. A linha volta a aparecer como Ativa." };
  });
}

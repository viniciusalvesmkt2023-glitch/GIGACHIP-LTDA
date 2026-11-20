import "server-only";
import { decryptField } from "./crypto";
import { sql } from "./db";
import { env } from "./env";
import type { Staff } from "./staff-auth";

/** Consultas do painel. Toda função recebe a equipe logada; dados sensíveis só via `revealSensitive` (auditado). */

export const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando_pagamento: "Aguardando pagamento",
  em_andamento: "Em andamento",
  pronto_para_ativacao: "Pronto para ativação",
  em_ativacao: "Em ativação",
  ativado: "Ativado",
  pendencia: "Pendência",
  expirado: "Expirado",
  cancelado: "Cancelado",
  cancelado_reembolso: "Cancelado (reembolso)",
};

export async function dashboardCounts(staff: Staff) {
  void staff; // exige chamador autenticado (requireStaff)
  const rows = await sql()<{ status: string; n: number }[]>`
    select status::text, count(*)::int as n from public.orders group by status`;
  const byStatus = Object.fromEntries(rows.map((r) => [r.status, r.n])) as Record<string, number>;
  const [extra] = await sql()<{ identity_review: number; revenue_cents: number; paid: number }[]>`
    select
      (select count(*)::int from public.orders where identity_status = 'in_review') as identity_review,
      (select coalesce(sum(amount_cents), 0)::int from public.payments where status in ('confirmed', 'received')) as revenue_cents,
      (select count(*)::int from public.payments where status in ('confirmed', 'received')) as paid`;
  return { byStatus, ...extra };
}

export type OrderListItem = {
  id: string;
  code: string;
  status: string;
  customerName: string;
  planName: string;
  simType: string;
  identityStatus: string;
  contractStatus: string;
  deviceStatus: string;
  createdAt: Date;
};

export async function listOrders(staff: Staff, filter: { status?: string; q?: string; identityReview?: boolean }) {
  void staff;
  const status = filter.status && STATUS_LABEL[filter.status] ? filter.status : null;
  const q = filter.q?.trim() || null;
  const rows = await sql()<
    {
      id: string; code: string; status: string; full_name: string; plan_name: string; sim_type: string;
      identity_status: string; contract_status: string; device_status: string; created_at: Date;
    }[]
  >`
    select o.id, o.code, o.status::text, c.full_name, o.plan_snapshot->>'name' as plan_name, o.sim_type::text,
           o.identity_status::text, o.contract_status::text, o.device_status::text, o.created_at
    from public.orders o join public.customers c on c.id = o.customer_id
    where (${status}::text is null or o.status::text = ${status})
      and (${filter.identityReview ?? false} = false or o.identity_status = 'in_review')
      and (${q}::text is null or o.code ilike ${"%" + (q ?? "") + "%"} or c.full_name ilike ${"%" + (q ?? "") + "%"}
           or c.email::text ilike ${"%" + (q ?? "") + "%"})
    order by o.created_at desc
    limit 200`;
  return rows.map<OrderListItem>((r) => ({
    id: r.id,
    code: r.code,
    status: r.status,
    customerName: r.full_name,
    planName: r.plan_name,
    simType: r.sim_type,
    identityStatus: r.identity_status,
    contractStatus: r.contract_status,
    deviceStatus: r.device_status,
    createdAt: r.created_at,
  }));
}

export async function getOrderDetail(staff: Staff, orderId: string) {
  void staff;
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;
  const [o] = await sql()<
    {
      id: string; code: string; status: string; payment_status: string; identity_status: string;
      contract_status: string; device_status: string; problem_reason: string | null; sim_type: string;
      plan_name: string; monthly_price_cents: number; created_at: Date; paid_at: Date | null; ready_at: Date | null;
      full_name: string; email: string; phone_e164: string; birth_date: string; cpf_last_digits: string;
      imei_last4: string | null; checksum_warnings: string[] | null; has_device: boolean;
    }[]
  >`
    select o.id, o.code, o.status::text, o.payment_status::text, o.identity_status::text, o.contract_status::text,
           o.device_status::text, o.problem_reason, o.sim_type::text, o.plan_snapshot->>'name' as plan_name,
           o.monthly_price_cents, o.created_at, o.paid_at, o.ready_at,
           c.full_name, c.email::text as email, c.phone_e164, c.birth_date::text as birth_date, c.cpf_last_digits,
           d.imei_last4, d.checksum_warnings, (d.id is not null) as has_device
    from public.orders o
    join public.customers c on c.id = o.customer_id
    left join public.device_info d on d.order_id = o.id
    where o.id = ${orderId}`;
  if (!o) return null;
  const events = await sql()<{ field: string; from_value: string | null; to_value: string | null; actor_type: string; reason: string | null; created_at: Date }[]>`
    select field, from_value, to_value, actor_type::text, reason, created_at
    from public.order_events where order_id = ${orderId} order by id desc limit 50`;
  return { ...o, cpfMasked: `***.***.***-${o.cpf_last_digits}`, events };
}

export type SensitiveField = "cpf" | "imei" | "eid" | "iccid";

/** Mostra um dado sensível completo — sempre registrado na auditoria. */
export async function revealSensitive(staff: Staff, orderId: string, field: SensitiveField, ip: string | null): Promise<string | null> {
  const key = env().FIELD_ENCRYPTION_KEY;
  const [row] = await sql()<{ cpf: Uint8Array; imei: Uint8Array | null; eid: Uint8Array | null; iccid: Uint8Array | null }[]>`
    select c.cpf_encrypted as cpf, d.imei_encrypted as imei, d.eid_encrypted as eid, d.iccid_encrypted as iccid
    from public.orders o join public.customers c on c.id = o.customer_id
    left join public.device_info d on d.order_id = o.id
    where o.id = ${orderId}`;
  const blob = row?.[field];
  if (!blob) return null;
  await sql()`
    insert into public.audit_log (actor_id, action, entity, entity_id, metadata, ip)
    values (${staff.id}, ${"revelar_" + field}, 'orders', ${orderId}, '{}'::jsonb, ${ip})`;
  return decryptField(blob, key);
}

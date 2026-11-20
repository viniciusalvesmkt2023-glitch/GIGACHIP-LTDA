import "server-only";
import { connection } from "next/server";
import { asaas } from "@/lib/integrations/asaas/client";
import { isPaymentEvent, reaisToCents, statusFromEvent } from "@/lib/integrations/asaas/mapping";
import { sql, withActor } from "./db";

type WebhookBody = { id?: string; event?: string; dateCreated?: string; payment?: { id?: string } };

/**
 * Registra o evento (idempotente). Retorna o id interno se ainda precisa ser processado,
 * ou null se já foi processado antes.
 */
export async function recordAsaasEvent(body: WebhookBody): Promise<bigint | null> {
  const event = body.event ?? "DESCONHECIDO";
  const eventId = body.id ?? `${event}:${body.payment?.id ?? "?"}:${body.dateCreated ?? "?"}`;
  const [row] = await sql()<{ id: bigint; processed_at: Date | null }[]>`
    insert into public.webhook_events (provider, event_id, event_type, payload)
    values ('asaas', ${eventId}, ${event}, ${sql().json(body as never)})
    on conflict (provider, event_id) do update set attempts = public.webhook_events.attempts
    returning id, processed_at`;
  return row.processed_at ? null : row.id;
}

/**
 * Processa um evento do Asaas. Nunca confia só no corpo do webhook: consulta a cobrança
 * na API e usa o status de lá (regra do CLAUDE.md).
 */
export async function processAsaasEvent(eventRowId: bigint): Promise<void> {
  const [ev] = await sql()<{ event_type: string; payload: WebhookBody }[]>`
    select event_type, payload from public.webhook_events where id = ${eventRowId}`;
  if (!ev) return;

  const finish = (note: string | null) => sql()`
    update public.webhook_events
    set processed_at = now(), attempts = attempts + 1, last_error = ${note}
    where id = ${eventRowId}`;

  const paymentId = ev.payload.payment?.id;
  if (!isPaymentEvent(ev.event_type) || !paymentId) {
    await finish("ignorado: evento sem cobrança");
    return;
  }

  try {
    const apiPayment = await asaas.getPayment(paymentId);
    const newStatus = statusFromEvent(ev.event_type, apiPayment.status);

    await withActor({ type: "webhook", reason: ev.event_type }, async (tx) => {
      let [payment] = await tx<{ id: string; order_id: string; amount_cents: number; is_first_payment: boolean }[]>`
        select id, order_id, amount_cents, is_first_payment
        from public.payments where provider_payment_id = ${apiPayment.id} for update`;

      // Mensalidades seguintes são criadas pelo Asaas: vincula pela assinatura
      if (!payment && apiPayment.subscription) {
        const [sub] = await tx<{ id: string; order_id: string; billing_type: string }[]>`
          select id, order_id, billing_type from public.subscriptions
          where provider_subscription_id = ${apiPayment.subscription}`;
        if (sub) {
          [payment] = await tx`
            insert into public.payments
              (order_id, subscription_id, provider_payment_id, billing_type, amount_cents, due_date, invoice_url)
            values (${sub.order_id}, ${sub.id}, ${apiPayment.id}, ${sub.billing_type},
                    ${reaisToCents(apiPayment.value)}, ${apiPayment.dueDate}, ${apiPayment.invoiceUrl})
            returning id, order_id, amount_cents, is_first_payment`;
        }
      }
      if (!payment) throw new IgnoredEvent("cobrança não pertence a nenhum pedido");
      if (reaisToCents(apiPayment.value) !== payment.amount_cents) {
        throw new Error(`valor divergente: Asaas ${apiPayment.value} × pedido ${payment.amount_cents / 100}`);
      }
      if (!newStatus) throw new IgnoredEvent(`status sem mapeamento: ${apiPayment.status}`);

      await tx`
        update public.payments
        set status = ${newStatus},
            paid_at = case when ${newStatus} in ('confirmed', 'received') then coalesce(paid_at, now()) else paid_at end,
            refunded_at = case when ${newStatus} = 'refunded' then coalesce(refunded_at, now()) else refunded_at end
        where id = ${payment.id}`;

      // O status do pedido acompanha a 1ª mensalidade; os triggers do banco aplicam as regras
      // (pago → em andamento, estorno → pendência, histórico).
      if (payment.is_first_payment) {
        await tx`update public.orders set payment_status = ${newStatus} where id = ${payment.order_id}`;
      }
    });
    await finish(null);
  } catch (err) {
    if (err instanceof IgnoredEvent) {
      await finish(`ignorado: ${err.message}`);
      return;
    }
    await sql()`
      update public.webhook_events set attempts = attempts + 1, last_error = ${String(err)}
      where id = ${eventRowId}`;
    throw err;
  }
}

class IgnoredEvent extends Error {}

/** Dados mínimos para a página de pagamento (sem dados pessoais). */
export type PaymentView = {
  orderCode: string;
  status: string;
  paymentStatus: string;
  planName: string;
  amountCents: number;
  billingType: "pix" | "credit_card" | "boleto" | "undefined";
  providerPaymentId: string | null;
  invoiceUrl: string | null;
  expiresAt: Date | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getPaymentView(orderId: string): Promise<PaymentView | null> {
  await connection();
  if (!UUID.test(orderId)) return null;
  const [row] = await sql()<
    {
      code: string;
      status: string;
      payment_status: string;
      plan_name: string;
      monthly_price_cents: number;
      billing_type: PaymentView["billingType"] | null;
      provider_payment_id: string | null;
      invoice_url: string | null;
      expires_at: Date | null;
    }[]
  >`
    select o.code, o.status, o.payment_status, o.plan_snapshot->>'name' as plan_name,
           o.monthly_price_cents, p.billing_type, p.provider_payment_id, p.invoice_url, o.expires_at
    from public.orders o
    left join public.payments p on p.order_id = o.id and p.is_first_payment
    where o.id = ${orderId}
    order by p.created_at desc nulls last
    limit 1`;
  if (!row) return null;
  return {
    orderCode: row.code,
    status: row.status,
    paymentStatus: row.payment_status,
    planName: row.plan_name,
    amountCents: row.monthly_price_cents,
    billingType: row.billing_type ?? "pix",
    providerPaymentId: row.provider_payment_id,
    invoiceUrl: row.invoice_url,
    expiresAt: row.expires_at,
  };
}

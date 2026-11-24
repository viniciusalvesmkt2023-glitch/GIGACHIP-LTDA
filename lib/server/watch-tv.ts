import "server-only";
import { asaas, AsaasError } from "@/lib/integrations/asaas/client";
import { centsToReais, reaisToCents } from "@/lib/integrations/asaas/mapping";
import { formatBRL } from "@/lib/domain/money";
import type { WatchTvStatus } from "@/lib/domain/watch-tv";
import { sql, withActor } from "./db";
import type { Staff } from "./staff-auth";

/**
 * Watch TV no painel (D44). A liberação é manual: o dono gera o acesso no sistema da Watch com o
 * e-mail do cliente e marca aqui. Cancelar só a TV diminui o valor da assinatura no Asaas.
 */

type Result = { ok: boolean; message: string };

const PAGO = ["confirmed", "received"];

async function audit(staff: Staff, action: string, orderId: string, metadata: Record<string, unknown> = {}) {
  await sql()`
    insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
    values (${staff.id}, ${action}, 'orders', ${orderId}, ${sql().json(metadata as never)})`;
}

/** Marca a Watch TV como liberada (o acesso já foi gerado e mandado para o cliente). */
export async function markWatchTvActive(staff: Staff, orderId: string): Promise<Result> {
  const [o] = await sql()<{ watch_tv_status: WatchTvStatus | null; payment_status: string }[]>`
    select watch_tv_status, payment_status::text from public.orders where id = ${orderId}`;
  if (!o?.watch_tv_status) return { ok: false, message: "Este pedido não tem Watch TV." };
  if (o.watch_tv_status !== "pendente") return { ok: false, message: "A Watch TV deste pedido já foi liberada ou cancelada." };
  if (!PAGO.includes(o.payment_status)) return { ok: false, message: "O pagamento ainda não foi confirmado. Libere depois que o cliente pagar." };
  await withActor({ type: "staff", id: staff.id, reason: "Watch TV liberada no sistema da Watch" }, (tx) => tx`
    update public.orders set watch_tv_status = 'ativo', watch_tv_activated_at = now()
    where id = ${orderId} and watch_tv_status = 'pendente'`);
  await audit(staff, "watch_tv_liberada", orderId);
  return { ok: true, message: "Watch TV marcada como liberada." };
}

/**
 * Cancela só a Watch TV: a assinatura do Asaas passa a cobrar só a linha (as cobranças já geradas
 * e ainda pendentes também são corrigidas). Lembre de cancelar o acesso no sistema da Watch.
 */
export async function cancelWatchTv(staff: Staff, orderId: string): Promise<Result> {
  const [o] = await sql()<
    { watch_tv_status: WatchTvStatus | null; monthly_price_cents: number; sub_id: string | null; provider_subscription_id: string | null; sub_status: string | null }[]
  >`
    select o.watch_tv_status, o.monthly_price_cents, s.id as sub_id, s.provider_subscription_id, s.status::text as sub_status
    from public.orders o left join public.subscriptions s on s.order_id = o.id
    where o.id = ${orderId}`;
  if (!o?.watch_tv_status) return { ok: false, message: "Este pedido não tem Watch TV." };
  if (o.watch_tv_status === "cancelado") return { ok: false, message: "A Watch TV deste pedido já está cancelada." };

  const ativa = o.sub_id && o.provider_subscription_id && o.sub_status === "active";
  if (ativa) {
    try {
      await asaas.updateSubscriptionValue(o.provider_subscription_id!, centsToReais(o.monthly_price_cents), true);
    } catch (e) {
      const detail = e instanceof AsaasError ? `${e.message} ${JSON.stringify(e.errors)}` : String(e);
      console.error(`[watch-tv] falha ao mudar o valor da assinatura: ${detail}`);
      return { ok: false, message: "Não consegui mudar o valor da assinatura no Asaas agora. Nada foi alterado; tente de novo em alguns minutos." };
    }
    // Acerta o valor das cobranças já geradas que ainda não foram pagas (o webhook confere o valor)
    const { data } = await asaas.listSubscriptionPayments(o.provider_subscription_id!).catch(() => ({ data: [] }));
    for (const p of data) {
      await sql()`
        update public.payments set amount_cents = ${reaisToCents(p.value)}
        where provider_payment_id = ${p.id} and status in ('pending', 'overdue')`;
    }
  }

  await withActor({ type: "staff", id: staff.id, reason: "cliente cancelou só a Watch TV" }, async (tx) => {
    await tx`
      update public.orders set watch_tv_status = 'cancelado', watch_tv_cancelled_at = now()
      where id = ${orderId} and watch_tv_status <> 'cancelado'`;
    if (ativa) await tx`update public.subscriptions set monthly_price_cents = ${o.monthly_price_cents} where id = ${o.sub_id}`;
  });
  await audit(staff, "watch_tv_cancelada", orderId, { nova_mensalidade_cents: o.monthly_price_cents });
  return {
    ok: true,
    message: ativa
      ? `Watch TV cancelada. A mensalidade passa a ser ${formatBRL(o.monthly_price_cents)} (só a linha). Lembre de cancelar o acesso no sistema da Watch.`
      : "Watch TV cancelada. Lembre de cancelar o acesso no sistema da Watch, se já tinha liberado.",
  };
}

/** Pedidos pagos com Watch TV esperando liberação (lista do painel). */
export async function pendingWatchTv(): Promise<{ id: string; code: string; full_name: string; paid_at: Date | null }[]> {
  return sql()`
    select o.id, o.code, c.full_name, o.paid_at
    from public.orders o join public.customers c on c.id = o.customer_id
    where o.watch_tv_status = 'pendente' and o.payment_status in ('confirmed', 'received')
    order by o.paid_at nulls last
    limit 100`;
}

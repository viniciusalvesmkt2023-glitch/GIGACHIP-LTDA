import "server-only";
import { formatDate, todayInSaoPaulo, dueDateForCycle } from "@/lib/domain/billing";
import { TERMS_VERSION, type CheckoutInput } from "@/lib/domain/checkout-input";
import { formatBRL } from "@/lib/domain/money";
import { asaas, AsaasError } from "@/lib/integrations/asaas/client";
import { centsToReais, mapAsaasPaymentStatus } from "@/lib/integrations/asaas/mapping";
import { cpfHash, encryptField } from "./crypto";
import { sql, withActor } from "./db";
import { issueAccessToken } from "./customer-access";
import { env } from "./env";
import { getActivePlanBySlug } from "./catalog";
import { shortOrderNumber } from "@/lib/domain/money";
import { WATCH_TV } from "@/lib/domain/watch-tv";

/** Prazo para pagar a 1ª mensalidade antes de o pedido expirar. */
const PAYMENT_WINDOW_HOURS = 48;

export type CheckoutResult =
  | { ok: true; orderId: string; accessToken: string }
  | { ok: false; code: "plano_indisponivel" | "tipo_chip_indisponivel" | "cadastro_divergente" | "falha_cobranca" };

export async function createCheckout(
  input: CheckoutInput,
  meta: { ip: string | null; userAgent: string | null },
): Promise<CheckoutResult> {
  const plan = await getActivePlanBySlug(input.planSlug);
  if (!plan) return { ok: false, code: "plano_indisponivel" };
  if (!plan.simTypesAllowed.includes(input.simType)) return { ok: false, code: "tipo_chip_indisponivel" };

  // Watch TV junto (D44): uma cobrança só com linha + TV
  const watchCents = input.watchTv ? WATCH_TV.precoCents : null;
  const totalCents = plan.monthlyPriceCents + (watchCents ?? 0);

  const keys = env();
  const hash = cpfHash(input.cpf, keys.CPF_HASH_KEY);

  type Step1 =
    | { kind: "divergente" }
    | { kind: "existente"; orderId: string; accessToken: string }
    | {
        kind: "novo";
        orderId: string;
        orderCode: string;
        customerId: string;
        asaasCustomerId: string | null;
        accessToken: string;
      };

  // 1) Cliente + consentimentos + pedido (ou reaproveita pedido aberto idêntico)
  const step1 = await withActor<Step1>({ type: "customer" }, async (tx) => {
    const [existing] = await tx<{ id: string; email: string; birth_date: string }[]>`
      select id, email::text as email, birth_date::text as birth_date
      from public.customers where cpf_hash = ${hash}`;

    let customerId: string;
    if (existing) {
      // Nunca sobrescrever dados de um cadastro existente a partir de um formulário público
      // (evita que alguém troque o e-mail de outra pessoa digitando o CPF dela).
      if (existing.email !== input.email || existing.birth_date !== input.birthDate) {
        return { kind: "divergente" as const };
      }
      customerId = existing.id;
    } else {
      const [created] = await tx<{ id: string }[]>`
        insert into public.customers
          (full_name, cpf_encrypted, cpf_hash, cpf_last_digits, birth_date, email, phone_e164, whatsapp_opt_in_at)
        values (${input.fullName}, ${encryptField(input.cpf, keys.FIELD_ENCRYPTION_KEY)}, ${hash},
                ${input.cpf.slice(-2)}, ${input.birthDate}, ${input.email}, ${input.phone},
                ${input.whatsappOptIn ? new Date() : null})
        returning id`;
      customerId = created.id;
    }

    // Sem caixinha de Termos/Privacidade (D38): só registra o "sim" opcional aos avisos pelo WhatsApp
    const consentTypes = input.whatsappOptIn ? ["whatsapp"] : [];
    for (const type of consentTypes) {
      await tx`
        insert into public.consents (customer_id, type, document_version, ip, user_agent)
        values (${customerId}, ${type}, ${TERMS_VERSION}, ${meta.ip}, ${meta.userAgent})`;
    }

    // Duplo clique / reenvio: reaproveita pedido aguardando pagamento do mesmo plano
    const [open] = await tx<{ id: string }[]>`
      select id from public.orders
      where customer_id = ${customerId} and plan_id = ${plan.id} and sim_type = ${input.simType}
        and status = 'aguardando_pagamento' and expires_at > now()
        and watch_tv_cents is not distinct from ${watchCents}
      order by created_at desc limit 1`;
    if (open) {
      return { kind: "existente" as const, orderId: open.id, accessToken: await issueAccessToken(tx, open.id, "checkout") };
    }

    const [order] = await tx<{ id: string; code: string }[]>`
      insert into public.orders (customer_id, plan_id, plan_snapshot, monthly_price_cents, sim_type, watch_tv_cents, watch_tv_status)
      values (${customerId}, ${plan.id}, ${tx.json(plan)}, ${plan.monthlyPriceCents}, ${input.simType},
              ${watchCents}, ${watchCents ? "pendente" : null})
      returning id, code`;
    const [sub] = await tx<{ provider_customer_id: string }[]>`
      select s.provider_customer_id from public.subscriptions s
      join public.orders o on o.id = s.order_id
      where o.customer_id = ${customerId} limit 1`;
    return {
      kind: "novo" as const,
      orderId: order.id,
      orderCode: shortOrderNumber(order.code),
      customerId,
      asaasCustomerId: sub?.provider_customer_id ?? null,
      accessToken: await issueAccessToken(tx, order.id, "checkout"),
    };
  });

  if (step1.kind === "divergente") return { ok: false, code: "cadastro_divergente" };
  if (step1.kind === "existente") return { ok: true, orderId: step1.orderId, accessToken: step1.accessToken };

  // 2) Cobrança no Asaas: assinatura mensal com 1ª mensalidade vencendo hoje (D9)
  const today = todayInSaoPaulo();
  let subscriptionId: string | null = null;
  try {
    const asaasCustomerId =
      step1.asaasCustomerId ??
      (
        await asaas.createCustomer({
          name: input.fullName,
          cpfCnpj: input.cpf,
          email: input.email,
          mobilePhone: input.phone.replace(/^\+55/, ""),
          externalReference: step1.customerId,
        })
      ).id;

    const subscription = await asaas.createSubscription({
      customer: asaasCustomerId,
      billingType: input.billingType === "pix" ? "PIX" : "CREDIT_CARD",
      value: centsToReais(totalCents),
      nextDueDate: formatDate(today),
      cycle: "MONTHLY",
      description: watchCents
        ? `Gigachip — ${plan.name} (${formatBRL(plan.monthlyPriceCents)}) + ${WATCH_TV.nome} (${formatBRL(watchCents)}) = ${formatBRL(totalCents)}/mês — pedido ${step1.orderCode}`
        : `Gigachip — ${plan.name} (${formatBRL(plan.monthlyPriceCents)}/mês) — pedido ${step1.orderCode}`,
      externalReference: step1.orderId,
    });
    subscriptionId = subscription.id;

    const { data: payments } = await asaas.listSubscriptionPayments(subscription.id);
    const first = [...payments].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    if (!first) throw new Error("assinatura criada sem cobrança inicial");

    // 3) Grava assinatura + 1ª cobrança e libera o pedido para pagamento
    await withActor({ type: "system" }, async (tx) => {
      const [sub] = await tx<{ id: string }[]>`
        insert into public.subscriptions
          (order_id, provider_customer_id, provider_subscription_id, billing_type, monthly_price_cents, due_day, next_due_date)
        values (${step1.orderId}, ${asaasCustomerId}, ${subscription.id}, ${input.billingType},
                ${totalCents}, ${today.day}, ${formatDate(dueDateForCycle(today, 1))})
        returning id`;
      await tx`
        insert into public.payments
          (order_id, subscription_id, provider_payment_id, billing_type, amount_cents, due_date, status, invoice_url, is_first_payment)
        values (${step1.orderId}, ${sub.id}, ${first.id}, ${input.billingType}, ${totalCents},
                ${first.dueDate}, ${mapAsaasPaymentStatus(first.status) ?? "pending"}, ${first.invoiceUrl}, true)`;
      await tx`
        update public.orders
        set status = 'aguardando_pagamento',
            expires_at = now() + make_interval(hours => ${PAYMENT_WINDOW_HOURS})
        where id = ${step1.orderId}`;
    });
    return { ok: true, orderId: step1.orderId, accessToken: step1.accessToken };
  } catch (err) {
    // Não deixar assinatura órfã cobrando todo mês
    if (subscriptionId) {
      await asaas.deleteSubscription(subscriptionId).catch(() => undefined);
    }
    const detail = err instanceof AsaasError ? `${err.message} ${JSON.stringify(err.errors)}` : String(err);
    console.error(`[checkout] falha ao gerar cobrança do pedido ${step1.orderCode}: ${detail}`);
    await sql()`
      insert into public.audit_log (action, entity, entity_id, metadata)
      values ('checkout_falha_cobranca', 'orders', ${step1.orderId}, ${sql().json({ detail })})`;
    return { ok: false, code: "falha_cobranca" };
  }
}

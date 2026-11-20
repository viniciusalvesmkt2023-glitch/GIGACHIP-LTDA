import "server-only";
import { asaas } from "@/lib/integrations/asaas/client";
import { d4sign, d4signConfigured } from "@/lib/integrations/d4sign/client";
import { processQueuedContracts } from "./contracts";
import { sql, withActor } from "./db";
import type { Staff } from "./staff-auth";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function maskEmail(e: string) {
  const [user, domain] = e.split("@");
  return `${user.slice(0, 2)}***@${domain}`;
}

export type ChangeEmailResult = { ok: boolean; messages: string[] };

/**
 * Corrige o e-mail de um cliente que digitou errado (D23).
 * - Atualiza o cadastro e invalida os links de acesso enviados ao e-mail errado.
 * - O e-mail aparece DENTRO do contrato: se ainda não foi assinado, o contrato antigo é cancelado
 *   na D4Sign e um novo é gerado e enviado para o e-mail certo (gasta 1 envio a mais).
 * - Atualiza o e-mail no Asaas (avisos de cobrança).
 */
export async function changeCustomerEmail(staff: Staff, orderId: string, rawEmail: string): Promise<ChangeEmailResult> {
  const newEmail = rawEmail.trim().toLowerCase();
  if (!EMAIL.test(newEmail)) return { ok: false, messages: ["E-mail inválido."] };

  const plan = await withActor({ type: "staff", id: staff.id, reason: "e-mail do cliente corrigido pela equipe" }, async (tx) => {
    const [o] = await tx<{ customer_id: string; old_email: string; contract_status: string; doc_uuid: string | null; asaas_customer: string | null }[]>`
      select o.customer_id, c.email::text as old_email, o.contract_status::text,
             ct.provider_document_uuid as doc_uuid, s.provider_customer_id as asaas_customer
      from public.orders o
      join public.customers c on c.id = o.customer_id
      left join public.contracts ct on ct.order_id = o.id
      left join public.subscriptions s on s.order_id = o.id
      where o.id = ${orderId} for update of o`;
    if (!o) return null;
    if (o.old_email === newEmail) return { same: true as const };

    await tx`update public.customers set email = ${newEmail} where id = ${o.customer_id}`;
    // Links enviados ao e-mail errado deixam de funcionar (o do navegador da compra continua)
    await tx`
      update public.order_access_tokens set revoked_at = now()
      where revoked_at is null and created_via in ('email', 'd4sign')
        and order_id in (select id from public.orders where customer_id = ${o.customer_id})`;
    await tx`
      insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
      values (${staff.id}, 'corrigir_email_cliente', 'orders', ${orderId},
              ${tx.json({ de: maskEmail(o.old_email), para: maskEmail(newEmail) })})`;

    // Contrato ainda não assinado → refaz com o e-mail certo
    let resendContract = false;
    if (o.contract_status !== "signed" && o.contract_status !== "not_created") {
      await tx`
        update public.contracts
        set status = 'queued', step = 'gerar_pdf', provider_document_uuid = null, pdf_sha256 = null,
            attempts = 0, last_error = null, next_attempt_at = now(), sent_at = null
        where order_id = ${orderId}`;
      await tx`update public.orders set contract_status = 'queued' where id = ${orderId}`;
      resendContract = true;
    }
    // Reenvia o e-mail do formulário (se o anterior já tinha saído)
    await tx`
      insert into public.notifications (order_id, customer_id, channel, template, dedupe_key)
      select ${orderId}, ${o.customer_id}, 'email', 'formulario_ativacao', ${`formulario_ativacao:${orderId}:${Date.now()}`}
      where not exists (select 1 from public.notifications
                        where order_id = ${orderId} and template = 'formulario_ativacao' and status = 'queued')`;
    return { same: false as const, oldDoc: resendContract ? o.doc_uuid : null, resendContract, contractStatus: o.contract_status, asaasCustomer: o.asaas_customer };
  });

  if (!plan) return { ok: false, messages: ["Pedido não encontrado."] };
  if (plan.same) return { ok: false, messages: ["O e-mail informado é igual ao atual."] };

  const messages = ["E-mail corrigido no cadastro."];
  if (plan.asaasCustomer) {
    await asaas
      .updateCustomerEmail(plan.asaasCustomer, newEmail)
      .then(() => messages.push("E-mail atualizado no Asaas."))
      .catch(() => messages.push("⚠️ Não foi possível atualizar no Asaas — corrija lá manualmente."));
  }
  if (plan.contractStatus === "signed") {
    messages.push("⚠️ O contrato já estava assinado com o e-mail antigo; ele não foi refeito.");
  }
  if (plan.resendContract && d4signConfigured()) {
    if (plan.oldDoc) {
      await d4sign
        .cancelDocument(plan.oldDoc, "E-mail do cliente corrigido; novo contrato enviado.")
        .then(() => messages.push("Contrato antigo cancelado na D4Sign."))
        .catch(() => messages.push("⚠️ Não foi possível cancelar o contrato antigo na D4Sign — cancele lá manualmente."));
    }
    const r = await processQueuedContracts(1).catch(() => null);
    messages.push(r?.sent ? "Novo contrato enviado para o e-mail correto." : "Novo contrato na fila; será enviado em instantes.");
  }
  return { ok: true, messages };
}

export async function orderCustomerEmail(orderId: string) {
  const [r] = await sql()<{ email: string }[]>`
    select c.email::text as email from public.orders o join public.customers c on c.id = o.customer_id where o.id = ${orderId}`;
  return r?.email ?? null;
}

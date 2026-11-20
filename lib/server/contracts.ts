import "server-only";
import { createHash } from "node:crypto";
import { renderContractPdf } from "@/lib/contract/pdf";
import { contractSettings } from "@/lib/contract/settings";
import { buildContract, CONTRACT_TEMPLATE_VERSION, type ContractData } from "@/lib/contract/template";
import { d4sign, d4signBudget, d4signConfigured, D4SignRateLimited } from "@/lib/integrations/d4sign/client";
import { CALLS_PER_CONTRACT, mapDocumentStatus, MAX_CONTRACT_ATTEMPTS, retryDelayMinutes } from "@/lib/integrations/d4sign/mapping";
import { issueAccessToken } from "./customer-access";
import { decryptBytes, decryptField, encryptBytes } from "./crypto";
import { sql, withActor, type Tx } from "./db";
import { env } from "./env";
import { identityMode } from "./identity-mode";

/**
 * Contrato pela D4Sign (D19, D20).
 * 1. Pagamento confirmado → contrato entra na fila (status "queued") — D21.
 * 2. O envio roda em etapas (PDF → signatário → aviso → enviar). Se falhar no meio, a próxima
 *    tentativa continua da etapa onde parou, sem repetir chamadas (o plano tem limite por hora).
 * 3. O aviso da D4Sign (ou a rotina diária) consulta o status; assinado → baixa o PDF assinado,
 *    guarda cifrado e marca o contrato como assinado (o pedido pode ficar "pronto para ativação").
 */

const STEPS = ["gerar_pdf", "cadastrar_signatario", "registrar_webhook", "enviar", "concluido"] as const;
type Step = (typeof STEPS)[number];

/**
 * Coloca o contrato na fila. Chamado na mesma transação que confirma o PAGAMENTO (D21).
 * Idempotente: se o contrato já foi enviado/assinado, não mexe em nada.
 */
export async function queueContract(tx: Tx, orderId: string): Promise<boolean> {
  const queued = await tx`
    insert into public.contracts (order_id, template_version, status, step, next_attempt_at)
    values (${orderId}, ${CONTRACT_TEMPLATE_VERSION}, 'queued', 'gerar_pdf', now())
    on conflict (order_id) do update
      set status = 'queued', attempts = 0, last_error = null, next_attempt_at = now()
      where public.contracts.status in ('not_created', 'error', 'cancelled', 'refused')
    returning id`;
  if (queued.length === 0) return false;
  await tx`update public.orders set contract_status = 'queued' where id = ${orderId}`;
  return true;
}

type ContractRow = {
  id: string;
  order_id: string;
  step: Step;
  attempts: number;
  provider_document_uuid: string | null;
  docs_to_cancel: string[];
  code: string;
  sim_type: "esim" | "physical";
  plan: { name: string; dataBaseGb: number; dataBonusGb: number; dataTotalGb: number; monthlyPriceCents: number };
  full_name: string;
  cpf_encrypted: Uint8Array;
  birth_date: string;
  email: string;
  phone_e164: string;
  due_day: number | null;
  billing_type: string | null;
};

async function loadContract(contractId: string): Promise<ContractRow | null> {
  const [row] = await sql()<ContractRow[]>`
    select ct.id, ct.order_id, ct.step, ct.attempts, ct.provider_document_uuid, ct.docs_to_cancel,
           o.code, o.sim_type::text as sim_type, o.plan_snapshot as plan,
           c.full_name, c.cpf_encrypted, c.birth_date::text as birth_date, c.email::text as email, c.phone_e164,
           s.due_day, s.billing_type::text as billing_type
    from public.contracts ct
    join public.orders o on o.id = ct.order_id
    join public.customers c on c.id = o.customer_id
    left join public.subscriptions s on s.order_id = o.id
    where ct.id = ${contractId}`;
  return row ?? null;
}

function contractData(r: ContractRow): ContractData {
  return {
    orderCode: r.code,
    customer: {
      fullName: r.full_name,
      cpf: decryptField(r.cpf_encrypted, env().FIELD_ENCRYPTION_KEY),
      birthDate: r.birth_date,
      email: r.email,
      phone: r.phone_e164,
    },
    plan: {
      name: r.plan.name,
      baseGb: r.plan.dataBaseGb,
      bonusGb: r.plan.dataBonusGb,
      totalGb: r.plan.dataTotalGb,
      monthlyPriceCents: r.plan.monthlyPriceCents,
    },
    simType: r.sim_type,
    billingType: r.billing_type === "credit_card" ? "credit_card" : "pix",
    dueDay: r.due_day ?? new Date().getDate(),
  };
}

function webhookUrl(): string | null {
  const e = env();
  if (!e.D4SIGN_WEBHOOK_SECRET) return null;
  return `${e.APP_URL.replace(/\/$/, "")}/api/webhooks/d4sign?token=${e.D4SIGN_WEBHOOK_SECRET}`;
}

/** Gera o PDF do contrato (sem enviar) — usado no envio e na prévia do painel. */
export async function renderOrderContract(contractId: string) {
  const r = await loadContract(contractId);
  if (!r) throw new Error("contrato não encontrado");
  const settings = contractSettings(env().APP_URL);
  return { row: r, pdf: await renderContractPdf(buildContract(contractData(r), settings), { orderCode: r.code, isTest: settings.isTest }) };
}

/** Executa as etapas pendentes de UM contrato. */
async function advance(contractId: string): Promise<void> {
  const r = await loadContract(contractId);
  if (!r) return;
  const e = env();
  if (!e.D4SIGN_SAFE_UUID) throw new Error("D4SIGN_SAFE_UUID não configurado");

  const remaining = STEPS.length - 1 - STEPS.indexOf(r.step);
  if ((await d4signBudget()) < Math.min(remaining, CALLS_PER_CONTRACT) + r.docs_to_cancel.length) {
    throw new D4SignRateLimited("aguardando limite da D4Sign");
  }

  // Cancela documentos antigos (ex.: e-mail do cliente corrigido) antes de enviar o novo
  for (const old of r.docs_to_cancel) {
    try {
      await d4sign.cancelDocument(old, "Substituído por um novo contrato (dados do cliente corrigidos).");
    } catch (err) {
      if (err instanceof D4SignRateLimited) throw err;
      // Já cancelado/finalizado na D4Sign: segue em frente, mas registra
      console.error(`[contratos] não foi possível cancelar ${old}: ${err instanceof Error ? err.message : err}`);
    }
    await sql()`update public.contracts set docs_to_cancel = array_remove(docs_to_cancel, ${old}) where id = ${contractId}`;
  }

  let step = r.step;
  let docUuid = r.provider_document_uuid;
  const save = (fields: { step: Step; doc?: string | null; sha?: string | null }) => sql()`
    update public.contracts
    set step = ${fields.step},
        provider_document_uuid = coalesce(${fields.doc ?? null}, provider_document_uuid),
        pdf_sha256 = coalesce(${fields.sha ?? null}, pdf_sha256)
    where id = ${contractId}`;

  if (step === "gerar_pdf") {
    const { pdf } = await renderOrderContract(contractId);
    docUuid = await d4sign.uploadPdf(e.D4SIGN_SAFE_UUID, pdf.bytes, `Contrato ${r.code}.pdf`);
    step = "cadastrar_signatario";
    await save({ step, doc: docUuid, sha: pdf.sha256 });
  }
  if (!docUuid) throw new Error("documento sem uuid na D4Sign");
  if (step === "cadastrar_signatario") {
    await d4sign.addSigner(docUuid, r.email, { docAndSelfie: identityMode() === "d4sign" });
    step = "registrar_webhook";
    await save({ step });
  }
  if (step === "registrar_webhook") {
    const url = webhookUrl();
    if (url) await d4sign.registerWebhook(docUuid, url);
    step = "enviar";
    await save({ step });
  }
  if (step === "enviar") {
    const token = await sql().begin((tx) => issueAccessToken(tx, r.order_id, "d4sign"));
    const formLink = `${e.APP_URL.replace(/\/$/, "")}/acesso/${token}`;
    await d4sign.sendToSigner(
      docUuid,
      `Olá, ${r.full_name.split(/\s+/)[0]}! Este é o contrato da sua linha Gigachip (pedido ${r.code}). Leia e assine. ` +
        `Depois, envie os dados do celular e seus documentos no formulário de ativação: ${formLink}`,
    );
    await withActor({ type: "system", reason: "contrato enviado para assinatura (D4Sign)" }, async (tx) => {
      await tx`
        update public.contracts set step = 'concluido', status = 'sent', sent_at = now(), last_error = null
        where id = ${contractId}`;
      await tx`update public.orders set contract_status = 'sent' where id = ${r.order_id}`;
    });
  }
}

/** Processa a fila de contratos (até `limit`). Chamado após aprovar identidade e pela rotina. */
export async function processQueuedContracts(limit = 2): Promise<{ sent: number; failed: number; skipped: string | null }> {
  if (!d4signConfigured()) return { sent: 0, failed: 0, skipped: "D4Sign não configurada" };
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < limit; i++) {
    // "Reserva" o próximo contrato (evita duas execuções pegarem o mesmo)
    const [next] = await sql()<{ id: string; attempts: number; order_id: string }[]>`
      update public.contracts set next_attempt_at = now() + interval '10 minutes'
      where id = (
        select id from public.contracts
        where status = 'queued' and next_attempt_at <= now()
        order by created_at limit 1 for update skip locked)
      returning id, attempts, order_id`;
    if (!next) break;
    try {
      await advance(next.id);
      sent++;
    } catch (err) {
      if (err instanceof D4SignRateLimited) {
        await sql()`update public.contracts set next_attempt_at = now() + interval '20 minutes' where id = ${next.id}`;
        return { sent, failed, skipped: "limite da D4Sign" };
      }
      failed++;
      const attempts = next.attempts + 1;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[contratos] falha no contrato ${next.id} (tentativa ${attempts}): ${message}`);
      if (attempts >= MAX_CONTRACT_ATTEMPTS) {
        await withActor({ type: "system", reason: `contrato com erro: ${message}` }, async (tx) => {
          await tx`update public.contracts set status = 'error', attempts = ${attempts}, last_error = ${message} where id = ${next.id}`;
          await tx`update public.orders set contract_status = 'error' where id = ${next.order_id}`;
        });
      } else {
        await sql()`
          update public.contracts
          set attempts = ${attempts}, last_error = ${message},
              next_attempt_at = now() + make_interval(mins => ${retryDelayMinutes(attempts)})
          where id = ${next.id}`;
      }
    }
  }
  return { sent, failed, skipped: null };
}

/** Consulta o status na D4Sign e atualiza o contrato. Idempotente. */
export async function syncContractByDocument(documentUuid: string, actor: "webhook" | "system" | "staff" = "webhook", staffId?: string) {
  const [c] = await sql()<{ id: string; order_id: string; status: string }[]>`
    select id, order_id, status::text from public.contracts where provider_document_uuid = ${documentUuid}`;
  if (!c) return { ok: false as const, reason: "contrato não encontrado" };
  if (c.status === "signed") return { ok: true as const, status: "signed" };

  const mapped = mapDocumentStatus(await d4sign.getDocument(documentUuid));
  if (mapped === "signed") {
    const signed = await d4sign.downloadSigned(documentUuid);
    const sha = createHash("sha256").update(signed).digest("hex");
    await withActor({ type: actor, id: staffId ?? null, reason: "contrato assinado (D4Sign)" }, async (tx) => {
      await tx`
        insert into public.contract_files (contract_id, content_encrypted, sha256)
        values (${c.id}, ${encryptBytes(signed, env().FIELD_ENCRYPTION_KEY)}, ${sha})
        on conflict (contract_id) do update set content_encrypted = excluded.content_encrypted, sha256 = excluded.sha256`;
      await tx`update public.contracts set status = 'signed', signed_at = now(), signed_file_path = 'db:contract_files' where id = ${c.id}`;
      await tx`update public.orders set contract_status = 'signed' where id = ${c.order_id}`;
      if (identityMode() === "d4sign") {
        // A D4Sign exigiu documento + selfie com reconhecimento facial para assinar (D25)
        await tx`
          insert into public.identity_checks (order_id, provider, provider_reference, status, attempts, decided_at)
          values (${c.order_id}, 'd4sign', ${documentUuid}, 'approved', 1, now())
          on conflict (order_id) do update
            set provider = 'd4sign', provider_reference = excluded.provider_reference, status = 'approved', decided_at = now()`;
        await tx`
          update public.orders set identity_status = 'approved'
          where id = ${c.order_id} and identity_status <> 'approved'`;
      }
    });
    return { ok: true as const, status: "signed" };
  }
  if (mapped === "cancelled" && c.status !== "refused") {
    await withActor({ type: actor, id: staffId ?? null, reason: "contrato cancelado/recusado na D4Sign" }, async (tx) => {
      await tx`update public.contracts set status = 'refused' where id = ${c.id}`;
      await tx`update public.orders set contract_status = 'refused' where id = ${c.order_id}`;
    });
    return { ok: true as const, status: "refused" };
  }
  return { ok: true as const, status: mapped ?? "desconhecido" };
}

/** Contratos enviados há mais de 1 h, ainda sem assinatura: confere o status (rede de segurança). */
export async function syncPendingSignatures(limit = 2) {
  if (!d4signConfigured()) return 0;
  const rows = await sql()<{ provider_document_uuid: string }[]>`
    select provider_document_uuid from public.contracts
    where status = 'sent' and provider_document_uuid is not null and sent_at < now() - interval '1 hour'
    order by sent_at limit ${limit}`;
  let n = 0;
  for (const r of rows) {
    if ((await d4signBudget()) < 2) break;
    await syncContractByDocument(r.provider_document_uuid, "system").catch((e) => console.error(`[contratos] sync: ${e}`));
    n++;
  }
  return n;
}

/** Volta um contrato com erro para a fila (botão do painel). */
export async function retryContract(orderId: string, staffId: string) {
  await withActor({ type: "staff", id: staffId, reason: "reenvio do contrato pedido pela equipe" }, async (tx) => {
    await tx`
      update public.contracts set status = 'queued', attempts = 0, last_error = null, next_attempt_at = now()
      where order_id = ${orderId} and status in ('queued', 'error', 'refused', 'cancelled')`;
    await tx`update public.orders set contract_status = 'queued' where id = ${orderId} and contract_status in ('queued', 'error', 'refused', 'cancelled')`;
  });
}

export async function readSignedContract(orderId: string, staffId: string, ip: string | null) {
  const [row] = await sql()<{ content: Uint8Array; code: string }[]>`
    select f.content_encrypted as content, o.code
    from public.contracts c
    join public.contract_files f on f.contract_id = c.id
    join public.orders o on o.id = c.order_id
    where c.order_id = ${orderId}`;
  if (!row) return null;
  await sql()`
    insert into public.audit_log (actor_id, action, entity, entity_id, metadata, ip)
    values (${staffId}, 'baixar_contrato_assinado', 'orders', ${orderId}, '{}'::jsonb, ${ip})`;
  return { code: row.code, bytes: decryptBytes(row.content, env().FIELD_ENCRYPTION_KEY) };
}

export async function getContractInfo(orderId: string) {
  const [c] = await sql()<{ id: string; status: string; step: string; attempts: number; last_error: string | null; sent_at: Date | null; signed_at: Date | null; has_file: boolean }[]>`
    select c.id, c.status::text, c.step, c.attempts, c.last_error, c.sent_at, c.signed_at,
           exists (select 1 from public.contract_files f where f.contract_id = c.id) as has_file
    from public.contracts c where c.order_id = ${orderId}`;
  return c ?? null;
}

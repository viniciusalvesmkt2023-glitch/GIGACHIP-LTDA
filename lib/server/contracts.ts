import "server-only";
import { createHash } from "node:crypto";
import { renderContractPdf } from "@/lib/contract/pdf";
import { contractSettings } from "@/lib/contract/settings";
import { buildContract, CONTRACT_TEMPLATE_VERSION, type ContractData } from "@/lib/contract/template";
import { d4sign, d4signBudget, d4signConfigured, D4SignRateLimited } from "@/lib/integrations/d4sign/client";
import { clicksign, clicksignConfigured, ClicksignError, ClicksignRateLimited } from "@/lib/integrations/clicksign/client";
import {
  cpfComPontos, evidenceFor, mapClicksignStatus, nomeParaClicksign, parseClicksignAuth, type ClicksignAuth,
} from "@/lib/integrations/clicksign/mapping";
import { CALLS_PER_CONTRACT, mapDocumentStatus, MAX_CONTRACT_ATTEMPTS, retryDelayMinutes } from "@/lib/integrations/d4sign/mapping";
import { issueAccessToken } from "./customer-access";
import { decryptBytes, decryptField, encryptBytes } from "./crypto";
import { sql, withActor, type Tx } from "./db";
import { env } from "./env";
import { identityMode } from "./identity-mode";
import { newContractProvider, PLATAFORMA, type ContractProvider } from "./signature-platform";
export { newContractProvider, PLATAFORMA, type ContractProvider };
import { shortOrderNumber } from "@/lib/domain/money";

/**
 * Contrato pela Clicksign (D45) — os contratos antigos, já enviados pela D4Sign, terminam por lá.
 * Os passos abaixo valem para as duas (D19, D20).
 * 1. Pagamento confirmado → contrato entra na fila (status "queued") — D21.
 * 2. O envio roda em etapas (PDF → signatário → aviso → enviar). Se falhar no meio, a próxima
 *    tentativa continua da etapa onde parou, sem repetir chamadas (o plano tem limite por hora).
 * 3. O aviso da D4Sign (ou a rotina diária) consulta o status; assinado → baixa o PDF assinado,
 *    guarda cifrado e marca o contrato como assinado (o pedido pode ficar "pronto para ativação").
 */

const STEPS = ["gerar_pdf", "cadastrar_signatario", "registrar_webhook", "enviar", "concluido"] as const;
/** Etapas da Clicksign (API v3): envelope → documento → signatário → requisitos → ativar → avisar. */
type ClicksignStep = "gerar_pdf" | "enviar_documento" | "cadastrar_signatario" | "requisitos" | "ativar" | "enviar" | "concluido";
type Step = (typeof STEPS)[number] | ClicksignStep;

const CLICKSIGN_AUTH_KEY = "clicksign_autenticacao";

/** Como o cliente se identifica na Clicksign (Configurações). Padrão: biometria facial. */
export async function getClicksignAuth(): Promise<ClicksignAuth> {
  const [row] = await sql()<{ value: unknown }[]>`select value from public.app_settings where key = ${CLICKSIGN_AUTH_KEY}`;
  return parseClicksignAuth(row?.value);
}

export async function setClicksignAuth(staffId: string, auth: ClicksignAuth) {
  await sql()`
    insert into public.app_settings (key, value, updated_by, updated_at)
    values (${CLICKSIGN_AUTH_KEY}, ${sql().json(auth)}, ${staffId}, now())
    on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`;
  await sql()`
    insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
    values (${staffId}, 'alterar_identificacao_contrato', 'app_settings', ${CLICKSIGN_AUTH_KEY}, ${sql().json({ para: auth })})`;
}

/**
 * Coloca o contrato na fila. Chamado na mesma transação que confirma o PAGAMENTO (D21).
 * Idempotente: se o contrato já foi enviado/assinado, não mexe em nada.
 */
export async function queueContract(tx: Tx, orderId: string): Promise<boolean> {
  const queued = await tx`
    insert into public.contracts (order_id, provider, template_version, status, step, next_attempt_at)
    values (${orderId}, ${newContractProvider()}, ${CONTRACT_TEMPLATE_VERSION}, 'queued', 'gerar_pdf', now())
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
  provider: ContractProvider;
  provider_envelope_id: string | null;
  provider_signer_id: string | null;
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
  watch_tv_cents: number | null;
};

async function loadContract(contractId: string): Promise<ContractRow | null> {
  const [row] = await sql()<ContractRow[]>`
    select ct.id, ct.order_id, ct.provider, ct.provider_envelope_id, ct.provider_signer_id, ct.step, ct.attempts, ct.provider_document_uuid, ct.docs_to_cancel,
           o.code, o.sim_type::text as sim_type, o.plan_snapshot as plan, o.watch_tv_cents,
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
    orderCode: shortOrderNumber(r.code),
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
    watchTvCents: r.watch_tv_cents,
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
  const settings = { ...contractSettings(), platform: PLATAFORMA[r.provider === "clicksign" ? "clicksign" : "d4sign"] };
  return { row: r, pdf: await renderContractPdf(buildContract(contractData(r), settings), { orderCode: shortOrderNumber(r.code), isTest: settings.isTest }) };
}

/** Mensagem do e-mail de assinatura, com o link de volta para o formulário de ativação. */
async function signatureMessage(r: ContractRow): Promise<string> {
  // created_via "d4sign" = link que vai dentro do e-mail da plataforma de assinatura (D4Sign ou Clicksign)
  const token = await sql().begin((tx) => issueAccessToken(tx, r.order_id, "d4sign"));
  const formLink = `${env().APP_URL.replace(/\/$/, "")}/acesso/${token}`;
  return (
    `Olá, ${r.full_name.split(/\s+/)[0]}! Este é o contrato da sua linha Gigachip (pedido ${shortOrderNumber(r.code)}). Leia e assine. ` +
    `Depois de assinar, volte ao formulário de ativação para falar com a gente no WhatsApp e ativar sua linha: ${formLink}`
  );
}

/**
 * Cancela documentos antigos (ex.: e-mail do cliente corrigido) antes de enviar o novo.
 * "clicksign:<envelope>:<documento>" = Clicksign; só o uuid = D4Sign.
 */
async function cancelOldDocuments(r: ContractRow) {
  for (const old of r.docs_to_cancel) {
    try {
      if (old.startsWith("clicksign:")) {
        const [, envelopeId, documentId] = old.split(":");
        if (envelopeId && documentId) await clicksign.cancelDocument(envelopeId, documentId);
      } else if (d4signConfigured()) {
        await d4sign.cancelDocument(old, "Substituído por um novo contrato (dados do cliente corrigidos).");
      }
    } catch (err) {
      if (err instanceof D4SignRateLimited || err instanceof ClicksignRateLimited) throw err;
      // Já cancelado/finalizado: segue em frente, mas registra
      console.error(`[contratos] não foi possível cancelar ${old}: ${err instanceof Error ? err.message : err}`);
    }
    await sql()`update public.contracts set docs_to_cancel = array_remove(docs_to_cancel, ${old}) where id = ${r.id}`;
  }
}

/** Executa as etapas pendentes de UM contrato. */
async function advance(contractId: string): Promise<void> {
  const r = await loadContract(contractId);
  if (!r) return;
  // Contrato que ainda não foi criado em nenhuma plataforma vai para a atual (Clicksign, quando configurada)
  if (r.step === "gerar_pdf" && !r.provider_document_uuid && !r.provider_envelope_id) {
    const target = newContractProvider();
    if (r.provider !== target) {
      await sql()`update public.contracts set provider = ${target} where id = ${contractId}`;
      r.provider = target;
    }
  }
  if (r.provider === "clicksign") return advanceClicksign(r);
  return advanceD4Sign(r);
}

/** Envio pela Clicksign (D45). Cada etapa é gravada; uma falha continua dali na próxima tentativa. */
async function advanceClicksign(r: ContractRow): Promise<void> {
  if (!clicksignConfigured()) throw new Error("Clicksign não configurada (CLICKSIGN_ACCESS_TOKEN)");
  await cancelOldDocuments(r);
  const contractId = r.id;
  const numero = shortOrderNumber(r.code).replace("#", "");
  let step = r.step;
  let envelopeId = r.provider_envelope_id;
  let documentId = r.provider_document_uuid;
  let signerId = r.provider_signer_id;
  const save = (f: { step: Step; envelope?: string; doc?: string; signer?: string; sha?: string; auth?: string }) => sql()`
    update public.contracts
    set step = ${f.step},
        provider_envelope_id = coalesce(${f.envelope ?? null}, provider_envelope_id),
        provider_document_uuid = coalesce(${f.doc ?? null}, provider_document_uuid),
        provider_signer_id = coalesce(${f.signer ?? null}, provider_signer_id),
        pdf_sha256 = coalesce(${f.sha ?? null}, pdf_sha256),
        signer_auth = coalesce(${f.auth ?? null}, signer_auth)
    where id = ${contractId}`;

  if (step === "gerar_pdf") {
    envelopeId = await clicksign.createEnvelope(`Contrato Gigachip pedido ${numero}`, await signatureMessage(r));
    step = "enviar_documento";
    await save({ step, envelope: envelopeId });
  }
  if (!envelopeId) throw new Error("contrato sem envelope na Clicksign");
  if (step === "enviar_documento") {
    const { pdf } = await renderOrderContract(contractId);
    documentId = (await clicksign.addDocument(envelopeId, `Contrato Gigachip pedido ${numero}.pdf`, pdf.bytes)).toLowerCase();
    step = "cadastrar_signatario";
    await save({ step, doc: documentId, sha: pdf.sha256 });
  }
  if (!documentId) throw new Error("contrato sem documento na Clicksign");
  if (step === "cadastrar_signatario") {
    signerId = await clicksign.addSigner(envelopeId, {
      name: nomeParaClicksign(r.full_name),
      email: r.email,
      cpf: cpfComPontos(decryptField(r.cpf_encrypted, env().FIELD_ENCRYPTION_KEY)),
      birthday: r.birth_date,
    });
    step = "requisitos";
    await save({ step, signer: signerId });
  }
  if (!signerId) throw new Error("contrato sem signatário na Clicksign");
  if (step === "requisitos") {
    // Assinar como parte + token por e-mail + identificação (biometria facial ou selfie + documento)
    const auth = await getClicksignAuth();
    const existing = await clicksign.listRequirements(envelopeId);
    if (!existing.some((x) => x.action === "agree")) {
      await clicksign.addRequirement(envelopeId, documentId, signerId, { action: "agree", role: "sign" });
    }
    for (const ev of evidenceFor(auth)) {
      if (!existing.some((x) => x.action === "provide_evidence" && x.auth === ev)) {
        await clicksign.addRequirement(envelopeId, documentId, signerId, { action: "provide_evidence", auth: ev });
      }
    }
    step = "ativar";
    await save({ step, auth });
  }
  if (step === "ativar") {
    try {
      await clicksign.activate(envelopeId);
    } catch (err) {
      // Já ativado numa tentativa anterior (a resposta se perdeu): segue em frente
      const doc = err instanceof ClicksignError ? await clicksign.getDocument(envelopeId, documentId).catch(() => null) : null;
      if (doc?.status !== "running") throw err;
    }
    step = "enviar";
    await save({ step });
  }
  if (step === "enviar") {
    await clicksign.notify(envelopeId, await signatureMessage(r));
    await withActor({ type: "system", reason: "contrato enviado para assinatura (Clicksign)" }, async (tx) => {
      // Sem aviso (webhook), confere sozinho só de 12 em 12 horas (a Clicksign não permite consultas frequentes)
      await tx`
        update public.contracts
        set step = 'concluido', status = 'sent', sent_at = now(), last_error = null, next_attempt_at = now() + interval '12 hours'
        where id = ${contractId}`;
      await tx`update public.orders set contract_status = 'sent' where id = ${r.order_id}`;
    });
  }
}

/** Envio pela D4Sign (contratos antigos, ou se a Clicksign não estiver configurada). */
async function advanceD4Sign(r: ContractRow): Promise<void> {
  const contractId = r.id;
  const e = env();
  if (!e.D4SIGN_SAFE_UUID) throw new Error("D4SIGN_SAFE_UUID não configurado");

  const idx = STEPS.indexOf(r.step as (typeof STEPS)[number]);
  const remaining = STEPS.length - 1 - (idx < 0 ? 0 : idx);
  if ((await d4signBudget()) < Math.min(remaining, CALLS_PER_CONTRACT) + r.docs_to_cancel.length) {
    throw new D4SignRateLimited("aguardando limite da D4Sign");
  }
  await cancelOldDocuments(r);

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
    docUuid = await d4sign.uploadPdf(e.D4SIGN_SAFE_UUID, pdf.bytes, `Contrato Gigachip pedido ${shortOrderNumber(r.code).replace("#", "")}.pdf`);
    step = "cadastrar_signatario";
    await save({ step, doc: docUuid, sha: pdf.sha256 });
  }
  if (!docUuid) throw new Error("documento sem uuid na D4Sign");
  if (step === "cadastrar_signatario") {
    const docAndSelfie = identityMode() === "d4sign";
    await d4sign.addSigner(docUuid, r.email, { docAndSelfie });
    step = "registrar_webhook";
    await save({ step });
    await sql()`update public.contracts set signer_auth = ${docAndSelfie ? "doc_selfie" : "email"} where id = ${contractId}`;
  }
  if (step === "registrar_webhook") {
    const url = webhookUrl();
    if (url) await d4sign.registerWebhook(docUuid, url);
    step = "enviar";
    await save({ step });
  }
  if (step === "enviar") {
    await d4sign.sendToSigner(docUuid, await signatureMessage(r));
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
  if (!d4signConfigured() && !clicksignConfigured()) return { sent: 0, failed: 0, skipped: "assinatura digital não configurada" };
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
      if (err instanceof ClicksignRateLimited) {
        await sql()`update public.contracts set next_attempt_at = now() + interval '1 minute' where id = ${next.id}`;
        return { sent, failed, skipped: "limite da Clicksign (tenta de novo em 1 minuto)" };
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

/** Consulta o status na plataforma (Clicksign ou D4Sign) e atualiza o contrato. Idempotente. */
export async function syncContractByDocument(documentUuid: string, actor: "webhook" | "system" | "staff" = "webhook", staffId?: string) {
  const [c] = await sql()<{ id: string; order_id: string; status: string; signer_auth: string | null; provider: ContractProvider; envelope: string | null }[]>`
    select id, order_id, status::text, signer_auth, provider, provider_envelope_id as envelope
    from public.contracts where provider_document_uuid = ${documentUuid}`;
  if (!c) return { ok: false as const, reason: "contrato não encontrado" };
  if (c.status === "signed") return { ok: true as const, status: "signed" };
  const nome = PLATAFORMA[c.provider];

  let mapped: string | null;
  let signedPdf: (() => Promise<Uint8Array>) | null = null;
  if (c.provider === "clicksign") {
    if (!c.envelope) return { ok: false as const, reason: "contrato sem envelope na Clicksign" };
    const doc = await clicksign.getDocument(c.envelope, documentUuid);
    mapped = mapClicksignStatus(doc.status);
    // Finalizado, mas o PDF assinado ainda não saiu: confere de novo no próximo minuto
    if (mapped === "signed" && !doc.signedUrl) return { ok: true as const, status: "sent" };
    if (doc.signedUrl) signedPdf = () => clicksign.downloadSigned(doc.signedUrl!);
  } else {
    mapped = mapDocumentStatus(await d4sign.getDocument(documentUuid));
    signedPdf = () => d4sign.downloadSigned(documentUuid);
  }

  if (mapped === "signed" && signedPdf) {
    const signed = await signedPdf();
    const sha = createHash("sha256").update(signed).digest("hex");
    await withActor({ type: actor, id: staffId ?? null, reason: `contrato assinado (${nome})` }, async (tx) => {
      await tx`
        insert into public.contract_files (contract_id, content_encrypted, sha256)
        values (${c.id}, ${encryptBytes(signed, env().FIELD_ENCRYPTION_KEY)}, ${sha})
        on conflict (contract_id) do update set content_encrypted = excluded.content_encrypted, sha256 = excluded.sha256`;
      await tx`update public.contracts set status = 'signed', signed_at = now(), signed_file_path = 'db:contract_files' where id = ${c.id}`;
      await tx`update public.orders set contract_status = 'signed' where id = ${c.order_id}`;
      if (c.signer_auth === "doc_selfie" || c.signer_auth === "facial_biometrics") {
        // A plataforma exigiu documento + rosto com reconhecimento facial para assinar (D25, D45)
        const provider = c.provider === "clicksign" ? "clicksign" : "d4sign";
        await tx`
          insert into public.identity_checks (order_id, provider, provider_reference, status, attempts, decided_at)
          values (${c.order_id}, ${provider}, ${documentUuid}, 'approved', 1, now())
          on conflict (order_id) do update
            set provider = excluded.provider, provider_reference = excluded.provider_reference, status = 'approved', decided_at = now()`;
        await tx`
          update public.orders set identity_status = 'approved'
          where id = ${c.order_id} and identity_status <> 'approved'`;
      } else if (identityMode() === "d4sign") {
        // Assinado SEM comparação automática do rosto (selfie + documento na Clicksign, ou contrato
        // antigo da D4Sign sem selfie): não aprova sozinho — a equipe confere no painel.
        const provider = c.signer_auth === "selfie_documento" ? "clicksign_selfie" : "d4sign_sem_selfie";
        await tx`
          insert into public.identity_checks (order_id, provider, provider_reference, status, attempts)
          values (${c.order_id}, ${provider}, ${documentUuid}, 'in_review', 1)
          on conflict (order_id) do update
            set provider = excluded.provider, provider_reference = excluded.provider_reference, status = 'in_review'
            where public.identity_checks.status <> 'approved'`;
        await tx`
          update public.orders set identity_status = 'in_review'
          where id = ${c.order_id} and identity_status not in ('approved', 'in_review')`;
      }
    });
    return { ok: true as const, status: "signed" };
  }
  if (mapped === "cancelled" && c.status !== "refused") {
    await withActor({ type: actor, id: staffId ?? null, reason: `contrato cancelado/recusado na ${nome}` }, async (tx) => {
      await tx`update public.contracts set status = 'refused' where id = ${c.id}`;
      await tx`update public.orders set contract_status = 'refused' where id = ${c.order_id}`;
    });
    return { ok: true as const, status: "refused" };
  }
  return { ok: true as const, status: mapped ?? "desconhecido" };
}

/**
 * Rotina (a cada minuto): confere na D4Sign os contratos enviados ainda sem assinatura.
 * - A D4Sign avisou (aviso de "assinou"/"finalizado") → confere a cada minuto, por até 1 hora
 *   (a D4Sign avisa um instante antes de terminar o PDF assinado). Sem isso o pedido só andava
 *   com o botão "Conferir assinatura".
 * - Sem aviso → confere de hora em hora (rede de segurança, caso o aviso se perca).
 * Cada conferência que não achou assinatura empurra a próxima (next_attempt_at), para não gastar
 * o limite de chamadas por hora da D4Sign.
 */
export async function syncPendingSignatures(limit = 3) {
  let n = 0;
  // Clicksign: o aviso (webhook) marca o contrato para conferir na hora; sem aviso, de 12 em 12 horas
  if (clicksignConfigured()) {
    const rows = await sql()<{ id: string; doc: string; notified: boolean }[]>`
      select c.id, c.provider_document_uuid as doc,
             exists (select 1 from public.webhook_events w
                     where w.provider = 'clicksign' and w.received_at > now() - interval '1 hour'
                       and (w.payload->>'document_key' = c.provider_document_uuid or w.payload->>'document_key' is null)) as notified
      from public.contracts c
      where c.provider = 'clicksign' and c.status = 'sent' and c.provider_document_uuid is not null
        and coalesce(c.next_attempt_at, '-infinity') <= now()
      order by c.next_attempt_at limit ${limit}`;
    for (const r of rows) {
      const res = await syncContractByDocument(r.doc, "system").catch((e) => {
        console.error(`[contratos] sync clicksign: ${e instanceof Error ? e.message : e}`);
        return null;
      });
      if (res?.status !== "signed") {
        await sql()`
          update public.contracts set next_attempt_at = now() + ${r.notified ? "1 minute" : "12 hours"}::interval
          where id = ${r.id} and status = 'sent'`;
      }
      n++;
    }
  }
  if (!d4signConfigured()) return n;
  const rows = await sql()<{ id: string; provider_document_uuid: string; notified: boolean }[]>`
    select c.id, c.provider_document_uuid, n.notified from public.contracts c
    cross join lateral (
      select exists (
        select 1 from public.webhook_events w
        where w.provider = 'd4sign' and w.payload->>'uuid' = c.provider_document_uuid
          and w.received_at > c.sent_at and w.received_at > now() - interval '1 hour'
      ) as notified
    ) n
    where c.provider = 'd4sign' and c.status = 'sent' and c.provider_document_uuid is not null
      and coalesce(c.next_attempt_at, '-infinity') <= now()
      and (n.notified or c.sent_at < now() - interval '1 hour')
    order by n.notified desc, c.sent_at limit ${limit}`;
  for (const r of rows) {
    if ((await d4signBudget()) < 2) break;
    const res = await syncContractByDocument(r.provider_document_uuid, "system").catch((e) => {
      console.error(`[contratos] sync: ${e}`);
      return null;
    });
    if (res?.status !== "signed") {
      await sql()`
        update public.contracts set next_attempt_at = now() + ${r.notified ? "1 minute" : "1 hour"}::interval
        where id = ${r.id} and status = 'sent'`;
    }
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
  return { code: shortOrderNumber(row.code).replace("#", ""), bytes: decryptBytes(row.content, env().FIELD_ENCRYPTION_KEY) };
}

export async function getContractInfo(orderId: string) {
  const [c] = await sql()<{
    id: string; status: string; step: string; attempts: number; last_error: string | null; sent_at: Date | null;
    signed_at: Date | null; has_file: boolean; next_attempt_at: Date | null; docs_to_cancel: string[]; provider: ContractProvider;
  }[]>`
    select c.id, c.status::text, c.provider, c.step, c.attempts, c.last_error, c.sent_at, c.signed_at, c.next_attempt_at, c.docs_to_cancel,
           exists (select 1 from public.contract_files f where f.contract_id = c.id) as has_file
    from public.contracts c where c.order_id = ${orderId}`;
  if (!c) return null;
  // Contrato que ainda vai ser criado segue para a plataforma atual
  const provider: ContractProvider = c.status === "queued" && c.step === "gerar_pdf" ? newContractProvider() : c.provider;
  if (c.status !== "queued" || provider !== "d4sign" || !d4signConfigured()) return { ...c, provider, d4sign: null };

  // Quantas chamadas este envio ainda precisa e quando o limite por hora libera essa quantidade
  const idx = STEPS.indexOf(c.step as (typeof STEPS)[number]);
  const needed = Math.min(STEPS.length - 1 - (idx < 0 ? 0 : idx), CALLS_PER_CONTRACT) + c.docs_to_cancel.length;
  const free = await d4signBudget();
  let freesAt: Date | null = null;
  if (free < needed) {
    const [row] = await sql()<{ at: Date | null }[]>`
      select created_at + interval '1 hour' as at from public.api_call_log
      where provider = 'd4sign' and created_at > now() - interval '1 hour'
      order by created_at offset ${needed - free - 1} limit 1`;
    freesAt = row?.at ?? null;
  }
  return { ...c, provider, d4sign: { free: Math.max(free, 0), limit: env().D4SIGN_RATE_LIMIT_PER_HOUR, needed, freesAt } };
}

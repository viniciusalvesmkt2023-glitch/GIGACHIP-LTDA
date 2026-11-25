import { createHash } from "node:crypto";
import { ClicksignRateLimited } from "@/lib/integrations/clicksign/client";
import { CLICKSIGN_FINAL_EVENTS, parseClicksignWebhook, verifyClicksignHmac } from "@/lib/integrations/clicksign/mapping";
import { syncContractByDocument } from "@/lib/server/contracts";
import { sql } from "@/lib/server/db";
import { env } from "@/lib/server/env";

/**
 * Aviso (webhook) da Clicksign (D45). Só aceita avisos com o "Content-Hmac" certo (HMAC SHA256 do
 * corpo com o secret do webhook). O conteúdo é só um "toque": o status é sempre conferido na API.
 */
export async function POST(request: Request) {
  const secret = env().CLICKSIGN_WEBHOOK_SECRET;
  if (!secret) return new Response("webhook_da_clicksign_nao_configurado", { status: 503 });
  const raw = await request.text();
  if (!verifyClicksignHmac(raw, request.headers.get("content-hmac"), secret)) {
    return new Response("unauthorized", { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("invalid body", { status: 400 });
  }
  const { event, documentKey } = parseClicksignWebhook(body);
  const eventId = createHash("sha256").update(raw).digest("hex");
  const [row] = await sql()<{ id: bigint }[]>`
    insert into public.webhook_events (provider, event_id, event_type, payload, processed_at)
    values ('clicksign', ${eventId}, ${`clicksign_${event ?? "aviso"}`}, ${sql().json({ event, document_key: documentKey })}, now())
    on conflict (provider, event_id) do nothing
    returning id`;
  if (!row) return Response.json({ received: true, duplicate: true });
  if (!event || (!CLICKSIGN_FINAL_EVENTS.has(event) && event !== "sign")) return Response.json({ received: true, ignored: event });

  // A rotina de cada minuto passa a conferir este contrato já. Se a chave não bater com nenhum
  // contrato, confere todos os enviados (são poucos por vez).
  const marked = documentKey
    ? await sql()`update public.contracts set next_attempt_at = now() where provider = 'clicksign' and status = 'sent' and provider_document_uuid = ${documentKey} returning id`
    : [];
  if (marked.length === 0) {
    await sql()`update public.contracts set next_attempt_at = now() where provider = 'clicksign' and status = 'sent'`;
  }
  if (!documentKey || marked.length === 0 || event === "sign") return Response.json({ received: true });

  try {
    const r = await syncContractByDocument(documentKey, "webhook");
    return Response.json({ received: true, ...r });
  } catch (err) {
    if (!(err instanceof ClicksignRateLimited)) console.error(`[webhook clicksign] ${String(err)}`);
    // Responde 200: o aviso ficou registrado e a rotina confere em instantes (evita reenvio em loop)
    return Response.json({ received: true, pending: "a rotina confere em instantes" });
  }
}

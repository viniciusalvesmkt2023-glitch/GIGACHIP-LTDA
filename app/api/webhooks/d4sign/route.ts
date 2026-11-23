import { timingSafeEqual } from "node:crypto";
import { documentUuidFromWebhook } from "@/lib/integrations/d4sign/mapping";
import { D4SignRateLimited } from "@/lib/integrations/d4sign/client";
import { syncContractByDocument } from "@/lib/server/contracts";
import { sql } from "@/lib/server/db";
import { env } from "@/lib/server/env";

/**
 * Aviso (webhook) da D4Sign. A URL registrada em cada documento leva uma senha (?token=).
 * O conteúdo do aviso é tratado só como um "toque": o status é sempre conferido na API da D4Sign.
 */
export async function POST(request: Request) {
  const secret = env().D4SIGN_WEBHOOK_SECRET;
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!secret || token.length !== secret.length || !timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
    return new Response("unauthorized", { status: 401 });
  }

  let body: Record<string, unknown> = {};
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) body = (await request.json()) as Record<string, unknown>;
    else body = Object.fromEntries((await request.formData()).entries());
  } catch {
    return new Response("invalid body", { status: 400 });
  }

  const uuid = documentUuidFromWebhook(body);
  const typePost = typeof body.type_post === "string" ? body.type_post : "";
  await sql()`
    insert into public.webhook_events (provider, event_id, event_type, payload, processed_at)
    values ('d4sign', ${`${uuid ?? "?"}:${typePost}:${Date.now()}`}, ${`d4sign_${typePost || "aviso"}`},
            ${sql().json({ uuid, type_post: typePost })}, now())`;
  if (!uuid) return Response.json({ received: true, ignored: "sem uuid" });

  // A rotina de cada minuto passa a conferir este contrato já (mesmo que o PDF ainda esteja sendo gerado)
  await sql()`update public.contracts set next_attempt_at = now() where provider_document_uuid = ${uuid} and status = 'sent'`;

  // type_post: 1 = documento finalizado, 2 = e-mail não entregue, 3 = cancelado, 4 = alguém assinou.
  // "4" chega segundos antes do "1": não gasta chamada da D4Sign com ele (o "1" vem logo em seguida).
  if (typePost === "4") return Response.json({ received: true, aguardando: "finalizado" });

  try {
    // Tenta na hora; se a D4Sign ainda estiver terminando o PDF, a rotina confere no minuto seguinte
    const r = await syncContractByDocument(uuid, "webhook");
    return Response.json({ received: true, ...r });
  } catch (err) {
    // Limite por hora da D4Sign: o aviso já ficou registrado e a rotina confere assim que liberar
    if (err instanceof D4SignRateLimited) return Response.json({ received: true, pending: "limite da D4Sign" }, { status: 202 });
    console.error(`[webhook d4sign] ${uuid}: ${String(err)}`);
    // Responde 200: o aviso ficou registrado e a rotina tenta de novo (evita a D4Sign reenviar em loop)
    return Response.json({ received: true, pending: "a rotina confere em instantes" });
  }
}

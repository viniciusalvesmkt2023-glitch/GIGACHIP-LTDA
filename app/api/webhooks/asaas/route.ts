import { after } from "next/server";
import { isValidWebhookToken } from "@/lib/integrations/asaas/mapping";
import { processQueuedContracts } from "@/lib/server/contracts";
import { processEmails } from "@/lib/server/email";
import { env } from "@/lib/server/env";
import { processAsaasEvent, recordAsaasEvent } from "@/lib/server/payments";

/**
 * Webhook do Asaas.
 * 1. Confere o token do header `asaas-access-token`.
 * 2. Grava o evento (idempotente — o mesmo evento nunca é processado duas vezes).
 * 3. Processa consultando a cobrança na API do Asaas.
 * Em caso de erro responde 500 para o Asaas reenviar; o reenvio reprocessa o mesmo registro.
 */
export async function POST(request: Request) {
  if (!isValidWebhookToken(request.headers.get("asaas-access-token"), env().ASAAS_WEBHOOK_TOKEN)) {
    return new Response("unauthorized", { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  if (typeof body !== "object" || body === null) return new Response("invalid body", { status: 400 });

  const pendingId = await recordAsaasEvent(body as Parameters<typeof recordAsaasEvent>[0]);
  if (pendingId === null) return Response.json({ received: true, duplicate: true });

  try {
    await processAsaasEvent(pendingId);
    // Envia contratos recém-colocados na fila depois de responder ao Asaas (resposta rápida)
    after(async () => {
      await processEmails(2).catch((e) => console.error(`[e-mails] ${e}`));
      await processQueuedContracts(1).catch((e) => console.error(`[contratos] ${e}`));
    });
  } catch (err) {
    console.error(`[webhook asaas] falha ao processar evento ${pendingId}: ${String(err)}`);
    return new Response("processing error", { status: 500 });
  }
  return Response.json({ received: true });
}

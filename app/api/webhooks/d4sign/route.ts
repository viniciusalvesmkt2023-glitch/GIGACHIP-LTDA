import { timingSafeEqual } from "node:crypto";
import { documentUuidFromWebhook } from "@/lib/integrations/d4sign/mapping";
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

  try {
    const r = await syncContractByDocument(uuid, "webhook");
    return Response.json({ received: true, ...r });
  } catch (err) {
    console.error(`[webhook d4sign] ${uuid}: ${String(err)}`);
    return new Response("processing error", { status: 500 });
  }
}

import { timingSafeEqual } from "node:crypto";
import { processQueuedContracts, syncPendingSignatures } from "@/lib/server/contracts";
import { processEmails } from "@/lib/server/email";

/**
 * Rotina agendada (Vercel Cron). A Vercel envia "Authorization: Bearer <CRON_SECRET>".
 * Hoje: envia contratos que ficaram na fila e confere assinaturas pendentes.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const got = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  if (!secret || got.length !== expected.length || !timingSafeEqual(Buffer.from(got), Buffer.from(expected))) {
    return new Response("unauthorized", { status: 401 });
  }
  const contracts = await processQueuedContracts(2);
  const synced = await syncPendingSignatures(2);
  const emails = await processEmails(20);
  return Response.json({ contracts, synced, emails });
}

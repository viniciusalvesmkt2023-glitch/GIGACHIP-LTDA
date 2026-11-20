import { timingSafeEqual } from "node:crypto";
import { processQueuedContracts, syncPendingSignatures } from "@/lib/server/contracts";
import { processEmails } from "@/lib/server/email";

/**
 * Rotina agendada (Vercel Cron). A Vercel envia "Authorization: Bearer <CRON_SECRET>".
 * Hoje: envia contratos que ficaram na fila e confere assinaturas pendentes.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  // Diferencia "não configurado" de "senha errada" para facilitar o diagnóstico (sem revelar a senha)
  if (!secret) return new Response("cron_secret_nao_configurado_na_vercel", { status: 503 });
  const got = (request.headers.get("authorization") ?? "").trim();
  const expected = `Bearer ${secret}`;
  if (got.length !== expected.length || !timingSafeEqual(Buffer.from(got), Buffer.from(expected))) {
    return new Response("senha_diferente_da_vercel", { status: 401 });
  }
  // Primeiro confere assinaturas já avisadas pela D4Sign (libera o cliente), depois envia contratos da fila
  const synced = await syncPendingSignatures(2);
  const contracts = await processQueuedContracts(2);
  const emails = await processEmails(20);
  return Response.json({ contracts, synced, emails });
}

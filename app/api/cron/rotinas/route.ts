import { timingSafeEqual } from "node:crypto";
import { processQueuedContracts, syncPendingSignatures } from "@/lib/server/contracts";
import { processEmails } from "@/lib/server/email";
import { syncOverdue } from "@/lib/server/inadimplencia";
import { expireUnpaidOrders } from "@/lib/server/payments";
import { importFromSheetIfDue, pushPendingToSheet } from "@/lib/server/planilha";

/**
 * Rotina agendada (Vercel Cron). A Vercel envia "Authorization: Bearer <CRON_SECRET>".
 * Hoje: confere assinaturas, envia contratos da fila, envia e-mails e puxa a inadimplência do Asaas.
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
  // Pedidos não pagos em 48 h: expira e apaga a assinatura no Asaas
  const expired = await expireUnpaidOrders().catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
  // Inadimplência: puxa as cobranças vencidas do Asaas (no máximo 1 vez por hora)
  const overdue = await syncOverdue().catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
  // Planilha do gestor: escreve o que ficou pendente e lê números novos (1 vez por hora)
  const sheetWrite = await pushPendingToSheet().catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
  const sheetRead = await importFromSheetIfDue().catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
  return Response.json({ contracts, synced, emails, expired, overdue, sheetWrite, sheetRead });
}

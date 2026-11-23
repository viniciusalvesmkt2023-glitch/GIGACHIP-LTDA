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
/** Roda a cada minuto (Vercel Cron, plano Pro): cada etapa tem o seu próprio intervalo. */
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  // Diferencia "não configurado" de "senha errada" para facilitar o diagnóstico (sem revelar a senha)
  if (!secret) return new Response("cron_secret_nao_configurado_na_vercel", { status: 503 });
  const got = (request.headers.get("authorization") ?? "").trim();
  const expected = `Bearer ${secret}`;
  if (got.length !== expected.length || !timingSafeEqual(Buffer.from(got), Buffer.from(expected))) {
    return new Response("senha_diferente_da_vercel", { status: 401 });
  }
  // Cada etapa roda separada: um erro numa (ex.: D4Sign ou Google fora do ar) não impede as outras.
  // E-mails primeiro: são rápidos e o cliente está esperando.
  const emails = await step("e-mails", () => processEmails(20));
  // Assinaturas já avisadas pela D4Sign (libera o cliente), depois contratos da fila
  const synced = await step("assinaturas", () => syncPendingSignatures(2));
  const contracts = await step("contratos", () => processQueuedContracts(2));
  // Pedidos não pagos em 48 h: expira e apaga a assinatura no Asaas
  const expired = await step("expirar pedidos", () => expireUnpaidOrders());
  // Inadimplência: puxa as cobranças vencidas do Asaas (no máximo 1 vez por hora)
  const overdue = await step("inadimplência", () => syncOverdue());
  // Planilha do gestor: escreve o que ficou pendente e lê números novos (1 vez por hora)
  const sheetWrite = await step("planilha (escrever)", () => pushPendingToSheet());
  const sheetRead = await step("planilha (ler)", () => importFromSheetIfDue());
  return Response.json({ contracts, synced, emails, expired, overdue, sheetWrite, sheetRead });
}

async function step<T>(name: string, fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[rotina] ${name}: ${error}`);
    return { error };
  }
}

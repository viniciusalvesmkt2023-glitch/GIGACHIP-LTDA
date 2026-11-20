/**
 * Regras puras da integração D4Sign (testáveis, sem rede).
 * Endpoints conferidos no conector oficial da D4Sign (@d4sign/n8n-nodes-d4sign 1.0.11).
 * Status do documento: ver `mapDocumentStatus` — CONFIRMAR no 1º teste real (D20).
 */
import type { ContractStatus } from "@/lib/domain/order-status";

export type D4SignDocument = { statusId: string | null; statusName: string | null };

/** GET /documents/{uuid} pode vir como objeto ou lista com um objeto. */
export function parseDocumentResponse(raw: unknown): D4SignDocument {
  const obj = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | undefined;
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = obj?.[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
    }
    return null;
  };
  return { statusId: pick("statusId", "status_id", "statusid"), statusName: pick("statusName", "status_name", "statusname") };
}

/**
 * Status da D4Sign → nosso status do contrato.
 * IDs usuais: 1 processando, 2 aguardando signatários, 3 aguardando assinaturas,
 * 4 finalizado, 5 arquivado, 6 cancelado, 7 editando. O nome é usado como segunda checagem.
 */
export function mapDocumentStatus(doc: D4SignDocument): ContractStatus | null {
  const name = (doc.statusName ?? "").toLowerCase();
  if (doc.statusId === "4" || name.includes("finaliz")) return "signed";
  if (doc.statusId === "6" || name.includes("cancel")) return "cancelled";
  if (["1", "2", "3", "7"].includes(doc.statusId ?? "") || name.includes("aguard") || name.includes("process")) return "sent";
  return null;
}

/** Extrai o uuid do documento do aviso da D4Sign (formulário ou JSON). */
export function documentUuidFromWebhook(body: Record<string, unknown>): string | null {
  const v = body.uuid ?? body.uuidDoc ?? body.uuid_doc ?? body.document_uuid;
  const s = typeof v === "string" ? v.trim() : "";
  return /^[0-9a-f-]{36}$/i.test(s) ? s.toLowerCase() : null;
}

/** Espera até a próxima tentativa (minutos): 15, 30, 60, 120... */
export function retryDelayMinutes(attempt: number): number {
  return Math.min(15 * 2 ** Math.max(0, attempt - 1), 24 * 60);
}

export const MAX_CONTRACT_ATTEMPTS = 6;
/** Chamadas à API por contrato enviado: upload, signatário, webhook, envio. */
export const CALLS_PER_CONTRACT = 4;

import "server-only";
import { sql } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { parseDocumentResponse, type D4SignDocument } from "./mapping";

/**
 * Cliente mínimo da API v1 da D4Sign. Autenticação: tokenAPI e cryptKey na URL (query string),
 * como no conector oficial. Cada chamada fica registrada em api_call_log para respeitar o limite
 * por hora do plano.
 */

export class D4SignError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export class D4SignRateLimited extends Error {}

export function d4signConfigured(): boolean {
  const e = env();
  return Boolean(e.D4SIGN_TOKEN_API && e.D4SIGN_CRYPT_KEY);
}

/** Quantas chamadas ainda cabem na janela da última hora. */
export async function d4signBudget(): Promise<number> {
  const [{ n }] = await sql()<{ n: number }[]>`
    select count(*)::int as n from public.api_call_log
    where provider = 'd4sign' and created_at > now() - interval '1 hour'`;
  return env().D4SIGN_RATE_LIMIT_PER_HOUR - n;
}

async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const e = env();
  if (!e.D4SIGN_TOKEN_API || !e.D4SIGN_CRYPT_KEY) throw new Error("D4Sign não configurada");
  if ((await d4signBudget()) <= 0) throw new D4SignRateLimited("limite de chamadas da D4Sign na última hora");
  await sql()`insert into public.api_call_log (provider, endpoint) values ('d4sign', ${path.replace(/[0-9a-f-]{36}/gi, ":id")})`;

  const url = new URL(`${e.D4SIGN_API_URL}${path}`);
  url.searchParams.set("tokenAPI", e.D4SIGN_TOKEN_API);
  url.searchParams.set("cryptKey", e.D4SIGN_CRYPT_KEY);
  const res = await fetch(url, {
    method,
    headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  if (!res.ok) {
    // Nunca incluir a URL (tem as chaves) nem o corpo enviado (tem dados pessoais) no erro
    const msg = (json as { message?: string })?.message ?? text.slice(0, 200);
    throw new D4SignError(`D4Sign ${method} ${path.replace(/[0-9a-f-]{36}/gi, ":id")} → ${res.status}: ${msg}`, res.status);
  }
  return json as T;
}

export const d4sign = {
  listSafes() {
    return request<{ uuid_safe: string; "name-safe"?: string; name_safe?: string }[]>("GET", "/safes");
  },

  /** Envia o PDF (base64) para o cofre. Retorna o uuid do documento. */
  async uploadPdf(safeUuid: string, pdf: Uint8Array, fileName: string): Promise<string> {
    const r = await request<{ uuid?: string }>("POST", `/documents/${safeUuid}/uploadbinary`, {
      base64_binary_file: Buffer.from(pdf).toString("base64"),
      mime_type: "application/pdf",
      name: fileName,
    });
    if (!r.uuid) throw new Error("D4Sign não retornou o uuid do documento");
    return r.uuid;
  },

  /** Cadastra o cliente como signatário ("act" 1 = assinar), com aviso por e-mail. */
  addSigner(documentUuid: string, email: string) {
    return request("POST", `/documents/${documentUuid}/createlist`, {
      signers: [
        {
          email,
          act: "1",
          foreign: "0",
          certificadoicpbr: "0",
          assinatura_presencial: "0",
          docauth: "0",
          docauthandselfie: "0",
          embed_methodauth: "email",
        },
      ],
    });
  },

  registerWebhook(documentUuid: string, url: string) {
    return request("POST", `/documents/${documentUuid}/webhooks`, { url });
  },

  sendToSigner(documentUuid: string, message: string) {
    return request("POST", `/documents/${documentUuid}/sendtosigner`, { message, skip_email: "0", workflow: "0" });
  },

  /** Cancela um documento (ex.: e-mail do cliente estava errado e um novo contrato será enviado). */
  cancelDocument(documentUuid: string, comment: string) {
    return request("POST", `/documents/${documentUuid}/cancel`, { comment });
  },

  async getDocument(documentUuid: string): Promise<D4SignDocument> {
    return parseDocumentResponse(await request("GET", `/documents/${documentUuid}`));
  },

  /** Baixa o PDF assinado (com o relatório de assinaturas). */
  async downloadSigned(documentUuid: string): Promise<Uint8Array> {
    const r = await request<{ url?: string }>("POST", `/documents/${documentUuid}/download`, {
      type: "pdf",
      language: "pt",
      document: "false",
    });
    if (!r.url) throw new Error("D4Sign não retornou o link de download");
    const file = await fetch(r.url, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!file.ok) throw new Error(`download do contrato assinado falhou: ${file.status}`);
    return new Uint8Array(await file.arrayBuffer());
  },
};

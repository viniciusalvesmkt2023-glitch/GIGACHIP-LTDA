import "server-only";
import { env } from "@/lib/server/env";

/**
 * Cliente mínimo da API v3 da Clicksign (JSON:API). Autenticação: header "Authorization" com o
 * access token (sem "Bearer"). Limite: 50 chamadas por conta a cada 10 segundos (produção).
 * Nunca colocar o token nem dados pessoais nas mensagens de erro.
 */

export class ClicksignError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Passou do limite (HTTP 429): tentar de novo daqui a pouco. */
export class ClicksignRateLimited extends Error {}

export function clicksignConfigured(): boolean {
  return Boolean(env().CLICKSIGN_ACCESS_TOKEN);
}

/** Produção (app.clicksign.com), sandbox ou outro servidor de teste, pelo endereço da API. */
export function clicksignMode(): "producao" | "sandbox" | "teste" {
  const url = env().CLICKSIGN_API_URL;
  if (/^https:\/\/app\.clicksign\.com\//.test(url)) return "producao";
  return url.includes("sandbox") ? "sandbox" : "teste";
}

type Resource = { id: string; type: string; attributes?: Record<string, unknown>; links?: Record<string, unknown>; relationships?: Record<string, unknown> };

const semIds = (path: string) => path.replace(/[0-9a-f-]{36}/gi, ":id");

async function request<T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<T> {
  const e = env();
  if (!e.CLICKSIGN_ACCESS_TOKEN) throw new Error("Clicksign não configurada");
  const res = await fetch(`${e.CLICKSIGN_API_URL.replace(/\/$/, "")}${path}`, {
    method,
    headers: {
      Authorization: e.CLICKSIGN_ACCESS_TOKEN,
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      "User-Agent": "gigachip-plataforma",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }
  if (res.status === 429) throw new ClicksignRateLimited("limite de chamadas da Clicksign (tente em instantes)");
  if (!res.ok) {
    const errors = (json as { errors?: { detail?: string; title?: string; code?: string }[] }).errors ?? [];
    const detail = errors.map((x) => x.detail ?? x.title ?? x.code).filter(Boolean).join("; ").slice(0, 300);
    throw new ClicksignError(`Clicksign ${method} ${semIds(path)} → ${res.status}${detail ? `: ${detail}` : ""}`, res.status);
  }
  return json as T;
}

const one = (r: { data?: Resource }) => {
  if (!r.data?.id) throw new Error("resposta da Clicksign sem id");
  return r.data;
};

export const clicksign = {
  /** Teste da chave (painel → Integrações): lista envelopes, sem criar nada. */
  async ping(): Promise<number> {
    const r = await request<{ data?: Resource[] }>("GET", "/envelopes");
    return (r.data ?? []).length;
  },

  /** 1) Envelope (a "pasta" do contrato). Finaliza sozinho na última assinatura; lembretes a cada 3 dias. */
  async createEnvelope(name: string, message: string): Promise<string> {
    const r = await request<{ data?: Resource }>("POST", "/envelopes", {
      data: {
        type: "envelopes",
        attributes: { name, locale: "pt-BR", auto_close: true, remind_interval: 3, block_after_refusal: true, default_message: message },
      },
    });
    return one(r).id;
  },

  /** 2) PDF do contrato (base64). */
  async addDocument(envelopeId: string, filename: string, pdf: Uint8Array): Promise<string> {
    const r = await request<{ data?: Resource }>("POST", `/envelopes/${envelopeId}/documents`, {
      data: {
        type: "documents",
        attributes: { filename, content_base64: `data:application/pdf;base64,${Buffer.from(pdf).toString("base64")}` },
      },
    });
    return one(r).id;
  },

  /** 3) Signatário: recebe o pedido de assinatura e o contrato assinado por e-mail. */
  async addSigner(envelopeId: string, s: { name: string; email: string; cpf: string; birthday: string }): Promise<string> {
    const r = await request<{ data?: Resource }>("POST", `/envelopes/${envelopeId}/signers`, {
      data: {
        type: "signers",
        attributes: {
          name: s.name,
          email: s.email,
          has_documentation: true,
          documentation: s.cpf,
          birthday: s.birthday,
          refusable: false,
          communicate_events: { signature_request: "email", signature_reminder: "email", document_signed: "email" },
        },
      },
    });
    return one(r).id;
  },

  /** Requisitos já criados (para não duplicar se uma tentativa anterior parou no meio). */
  async listRequirements(envelopeId: string): Promise<{ action: string; auth: string | null }[]> {
    const r = await request<{ data?: Resource[] }>("GET", `/envelopes/${envelopeId}/requirements`);
    return (r.data ?? []).map((x) => ({ action: String(x.attributes?.action ?? ""), auth: (x.attributes?.auth as string | undefined) ?? null }));
  },

  /** 4) Requisito: "agree" (assinar como parte) ou "provide_evidence" (uma forma de identificação). */
  async addRequirement(envelopeId: string, documentId: string, signerId: string, attributes: Record<string, string>): Promise<void> {
    await request("POST", `/envelopes/${envelopeId}/requirements`, {
      data: {
        type: "requirements",
        attributes,
        relationships: {
          document: { data: { type: "documents", id: documentId } },
          signer: { data: { type: "signers", id: signerId } },
        },
      },
    });
  },

  /** 5) Ativa o envelope (passa a aceitar assinaturas). */
  async activate(envelopeId: string): Promise<void> {
    await request("PATCH", `/envelopes/${envelopeId}`, { data: { id: envelopeId, type: "envelopes", attributes: { status: "running" } } });
  },

  /** 6) Manda o e-mail de "assine o contrato" para o signatário. */
  async notify(envelopeId: string, message: string): Promise<void> {
    await request("POST", `/envelopes/${envelopeId}/notifications`, { data: { type: "notifications", attributes: { message } } });
  },

  /** Situação do documento e link do PDF assinado (o link vale 5 minutos). */
  async getDocument(envelopeId: string, documentId: string): Promise<{ status: string | null; signedUrl: string | null }> {
    const r = await request<{ data?: Resource }>("GET", `/envelopes/${envelopeId}/documents/${documentId}`);
    const files = (r.data?.links?.files ?? {}) as { signed?: string | null };
    return { status: (r.data?.attributes?.status as string | undefined) ?? null, signedUrl: files.signed ?? null };
  },

  /** Baixa o PDF assinado (link temporário do armazenamento da Clicksign; não conta no limite). */
  async downloadSigned(url: string): Promise<Uint8Array> {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new ClicksignError(`download do contrato assinado → ${res.status}`, res.status);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length < 100 || Buffer.from(bytes.subarray(0, 5)).toString() !== "%PDF-") throw new Error("o arquivo assinado não é um PDF");
    return bytes;
  },

  /** Cancela um documento em andamento (ex.: e-mail do cliente corrigido). */
  async cancelDocument(envelopeId: string, documentId: string): Promise<void> {
    await request("PATCH", `/envelopes/${envelopeId}/documents/${documentId}`, {
      data: { id: documentId, type: "documents", attributes: { status: "canceled" } },
    });
  },
};

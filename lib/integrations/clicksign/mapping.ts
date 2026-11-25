/**
 * Regras puras da integração Clicksign (API v3 — "API do Envelope"), testáveis sem rede (D45).
 * Conferido na documentação oficial (developers.clicksign.com, nov/2026).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { ContractStatus } from "@/lib/domain/order-status";

/**
 * Como o cliente se identifica na assinatura (escolhido em Configurações):
 * - facial_biometrics: biometria facial — a Clicksign compara o rosto com o documento (R$ 1,50 cada).
 *   Contrato assinado = identidade aprovada, como era com a D4Sign.
 * - selfie_documento: selfie + foto do documento (frente e verso), sem comparação automática.
 *   A equipe confere no painel antes de ativar.
 */
export type ClicksignAuth = "facial_biometrics" | "selfie_documento";
export const CLICKSIGN_AUTH_DEFAULT: ClicksignAuth = "facial_biometrics";

export const CLICKSIGN_AUTH_LABEL: Record<ClicksignAuth, string> = {
  facial_biometrics: "Biometria facial (compara o rosto com o documento) — R$ 1,50 por assinatura",
  selfie_documento: "Selfie + foto do documento (sem comparação automática; a equipe confere) — sem custo extra",
};

export function parseClicksignAuth(v: unknown): ClicksignAuth {
  return v === "selfie_documento" ? "selfie_documento" : CLICKSIGN_AUTH_DEFAULT;
}

/** Requisitos de autenticação ("provide_evidence") de cada forma: token por e-mail + as provas. */
export function evidenceFor(auth: ClicksignAuth): string[] {
  return auth === "facial_biometrics" ? ["email", "facial_biometrics"] : ["email", "official_document", "selfie"];
}

/** Status do documento na Clicksign → nosso status do contrato. */
export function mapClicksignStatus(status: string | null | undefined): ContractStatus | null {
  switch ((status ?? "").toLowerCase()) {
    case "closed":
      return "signed";
    case "canceled":
    case "cancelled":
      return "cancelled";
    case "running":
    case "draft":
      return "sent";
    default:
      return null;
  }
}

/** Confere o cabeçalho "Content-Hmac: sha256=<hex>" (HMAC SHA256 do corpo cru com o secret do webhook). */
export function verifyClicksignHmac(rawBody: string, header: string | null, secret: string): boolean {
  if (!header || !secret) return false;
  const got = header.trim().replace(/^sha256=/i, "").toLowerCase();
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  if (got.length !== expected.length || !/^[0-9a-f]+$/.test(got)) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

/** Nome do evento e chave do documento do aviso (webhook) da Clicksign. */
export function parseClicksignWebhook(body: unknown): { event: string | null; documentKey: string | null } {
  const b = (body ?? {}) as { event?: { name?: unknown }; document?: { key?: unknown; id?: unknown } };
  const event = typeof b.event?.name === "string" ? b.event.name : null;
  const raw = b.document?.key ?? b.document?.id;
  const key = typeof raw === "string" && /^[0-9a-f-]{36}$/i.test(raw.trim()) ? raw.trim().toLowerCase() : null;
  return { event, documentKey: key };
}

/** Eventos que mudam o contrato: vale conferir o documento na API logo em seguida. */
export const CLICKSIGN_FINAL_EVENTS = new Set(["auto_close", "document_closed", "close", "cancel", "refusal", "deadline"]);

/** "52998224725" → "529.982.247-25" (formato que a Clicksign pede no signatário). */
export function cpfComPontos(cpf: string): string {
  const d = cpf.replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : cpf;
}

/** Nome aceito pela Clicksign: nome e sobrenome, sem números. */
export function nomeParaClicksign(nome: string): string {
  const limpo = nome.replace(/[0-9]/g, "").replace(/\s+/g, " ").trim();
  return limpo.split(" ").length >= 2 ? limpo : `${limpo} Cliente`;
}

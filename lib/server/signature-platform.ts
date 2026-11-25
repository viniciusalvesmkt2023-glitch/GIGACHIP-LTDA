import "server-only";
import { clicksignConfigured } from "@/lib/integrations/clicksign/client";

/** Plataforma de assinatura dos contratos (D45): Clicksign quando configurada; antes, D4Sign. */
export type ContractProvider = "d4sign" | "clicksign";

/** Para onde vão os contratos NOVOS. */
export function newContractProvider(): ContractProvider {
  return clicksignConfigured() ? "clicksign" : "d4sign";
}

/** Nome da plataforma para os textos (e-mail, telas, contrato). */
export const PLATAFORMA: Record<ContractProvider, string> = { clicksign: "Clicksign", d4sign: "D4Sign" };

/** Nome da plataforma que o cliente vai ver: a do contrato já enviado, ou a atual. */
export function plataformaDoContrato(provider: string | null | undefined, jaEnviado: boolean): string {
  return jaEnviado && (provider === "d4sign" || provider === "clicksign") ? PLATAFORMA[provider] : PLATAFORMA[newContractProvider()];
}

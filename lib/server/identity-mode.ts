import "server-only";

/**
 * Como a identidade é validada (D25):
 * - "d4sign" (padrão): na assinatura do contrato a D4Sign exige foto do documento + selfie com
 *   reconhecimento facial. Contrato assinado = identidade validada, sem ninguém aprovar.
 * - "manual": o cliente envia documento + selfie no formulário e a equipe aprova no painel.
 */
export type IdentityMode = "d4sign" | "manual";

export function identityMode(): IdentityMode {
  return process.env.IDENTITY_MODE === "manual" ? "manual" : "d4sign";
}

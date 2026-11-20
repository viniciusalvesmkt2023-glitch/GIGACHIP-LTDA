import { CONTRACT_TEMPLATE_VERSION, type ContractSettings } from "./template";

/**
 * Condições do contrato decididas pelos sócios (docs/07-decisoes.md, D10 e D19).
 * O WhatsApp vem da mesma variável do site (NEXT_PUBLIC_WHATSAPP_NUMBER): quando o número for
 * cadastrado na Vercel, ele aparece no site e nos contratos novos.
 */
export const BLOCKED_DAYS_BEFORE_CANCEL = 5;

function formatWhatsapp(raw: string | undefined): string | null {
  const d = (raw ?? "").replace(/\D/g, "").replace(/^55/, "");
  if (d.length !== 11) return null;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function contractSettings(appUrl: string): ContractSettings {
  return {
    version: CONTRACT_TEMPLATE_VERSION,
    isTest: true, // vira false quando o advogado aprovar o texto
    whatsapp: formatWhatsapp(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER),
    supportEmail: "suporte@gigachip.com.br",
    privacyUrl: `${appUrl.replace(/\/$/, "")}/privacidade`,
    dpoEmail: "suporte@gigachip.com.br",
    unblockTime: "24 (vinte e quatro) horas",
    blockedDaysBeforeCancel: BLOCKED_DAYS_BEFORE_CANCEL,
  };
}

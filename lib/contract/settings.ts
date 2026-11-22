import { CONTACT_EMAIL, WHATSAPP_DEFAULT } from "@/lib/site";
import { CONTRACT_TEMPLATE_VERSION, type ContractSettings } from "./template";

/**
 * Condições do contrato decididas pelos sócios (docs/07-decisoes.md, D10 e D19).
 * O WhatsApp vem da mesma variável do site (NEXT_PUBLIC_WHATSAPP_NUMBER): quando o número for
 * cadastrado na Vercel, ele aparece no site e nos contratos novos.
 */
export const BLOCKED_DAYS_BEFORE_CANCEL = 5;

/** "558581290832" → "(85) 8129-0832"; "5588999991556" → "(88) 99999-1556". */
export function formatWhatsapp(raw: string | undefined): string | null {
  const d = (raw ?? "").replace(/\D/g, "").replace(/^55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return null;
}

export function contractSettings(): ContractSettings {
  return {
    version: CONTRACT_TEMPLATE_VERSION,
    isTest: false, // texto aprovado pelo advogado (22/11/2026)
    whatsapp: formatWhatsapp(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || WHATSAPP_DEFAULT),
    supportEmail: CONTACT_EMAIL,
    unblockTime: "24 (vinte e quatro) horas",
    blockedDaysBeforeCancel: BLOCKED_DAYS_BEFORE_CANCEL,
  };
}

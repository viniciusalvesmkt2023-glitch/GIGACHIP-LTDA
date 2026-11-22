import { WHATSAPP_DEFAULT } from "@/lib/site";

/** Número de atendimento (público): o da Vercel, se existir; senão o padrão (lib/site.ts). */
export const WHATSAPP_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || WHATSAPP_DEFAULT).replace(/\D/g, "");

/** Link wa.me. Nunca inclua CPF, documentos ou outros dados pessoais na mensagem. */
export function whatsappLink(message: string): string | null {
  if (!WHATSAPP_NUMBER) return null;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/** Número de atendimento (público). Vazio = botão escondido até o número ser definido. */
export const WHATSAPP_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");

/** Link wa.me. Nunca inclua CPF, documentos ou outros dados pessoais na mensagem. */
export function whatsappLink(message: string): string | null {
  if (!WHATSAPP_NUMBER) return null;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

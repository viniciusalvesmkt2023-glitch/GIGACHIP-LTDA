"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { parseCheckoutForm, type FieldErrors } from "@/lib/domain/checkout-input";
import { createCheckout } from "@/lib/server/checkout";
import { setAccessCookie } from "@/lib/server/customer-access";

export type CheckoutFormState = { errors: FieldErrors; values: Record<string, string> };

const FIELDS = [
  "planSlug", "fullName", "cpf", "birthDate", "email", "phone",
  "simType", "billingType", "whatsappOptIn", "watchTv",
] as const;

const MESSAGES = {
  plano_indisponivel: "Este plano não está mais disponível.",
  tipo_chip_indisponivel: "Este plano não está disponível para o tipo de chip escolhido.",
  cadastro_divergente:
    "Já existe um cadastro com este CPF e os dados não conferem. Fale com a gente pelo WhatsApp para atualizar seu cadastro.",
  falha_cobranca: "Não conseguimos gerar a cobrança agora. Tente novamente em alguns minutos.",
} as const;

/**
 * Ação pública (qualquer um pode chamar via POST): valida tudo no servidor e só aceita os
 * campos conhecidos. A confirmação de pagamento NUNCA acontece aqui — só via webhook.
 */
export async function submitCheckout(_prev: CheckoutFormState, formData: FormData): Promise<CheckoutFormState> {
  const values: Record<string, string> = {};
  for (const f of FIELDS) {
    const v = formData.get(f);
    if (typeof v === "string") values[f] = v;
  }

  const parsed = parseCheckoutForm(values);
  if (!parsed.ok) return { errors: parsed.errors, values };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const result = await createCheckout(parsed.value, { ip, userAgent: h.get("user-agent") });

  if (!result.ok) return { errors: { form: MESSAGES[result.code] }, values };
  await setAccessCookie(result.accessToken);
  redirect(`/pedido/${result.orderId}/pagamento`);
}

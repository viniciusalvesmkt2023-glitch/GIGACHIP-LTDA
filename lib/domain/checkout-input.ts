import { z } from "zod";
import { isValidCpf, normalizeBrMobile, onlyDigits } from "./validators";

/** Versão do aviso aceito (hoje só o opcional de avisos pelo WhatsApp) — `consents.document_version`. */
export const TERMS_VERSION = "aviso-whatsapp-2026-11";

/** "20/05/1975" → "1975-05-20" (o formulário digita com barras); ISO passa direto. */
export function birthDateToIso(v: string): string {
  const m = /^\s*(\d{2})\/(\d{2})\/(\d{4})\s*$/.exec(v);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : v.trim();
}

const MIN_AGE = 18;

function ageOn(birth: Date, today: Date): number {
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const m = today.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}

const checked = z
  .union([z.literal("on"), z.literal("true"), z.boolean()])
  .optional()
  .transform((v) => v === true || v === "on" || v === "true");

/** Formulário inicial da contratação (D2). Mensagens em português para o cliente. */
export function checkoutInputSchema(today: Date = new Date()) {
  return z
    .object({
      planSlug: z.string().regex(/^[a-z0-9-]+$/, "Plano inválido."),
      fullName: z
        .string()
        .trim()
        .min(5, "Informe o nome completo.")
        .max(120, "Nome muito longo.")
        .refine((v) => v.split(/\s+/).length >= 2, "Informe nome e sobrenome."),
      cpf: z
        .string()
        .transform(onlyDigits)
        .refine(isValidCpf, "CPF inválido."),
      birthDate: z
        .string()
        .transform(birthDateToIso)
        .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), "Digite a data completa (dd/mm/aaaa).")
        .refine((v) => {
          const [y, m, d] = v.split("-").map(Number) as [number, number, number];
          const dt = new Date(Date.UTC(y, m - 1, d));
          return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
        }, "Data de nascimento inválida.")
        .refine((v) => {
          const d = new Date(`${v}T00:00:00Z`);
          return Number.isNaN(d.getTime()) || (ageOn(d, today) >= MIN_AGE && ageOn(d, today) < 120);
        }, `É preciso ter ${MIN_AGE} anos ou mais.`),
      email: z.string().trim().toLowerCase().email("E-mail inválido.").max(200),
      phone: z
        .string()
        .transform((v, ctx) => {
          const e164 = normalizeBrMobile(v);
          if (!e164) {
            ctx.addIssue({ code: "custom", message: "Celular inválido. Use DDD + número." });
            return z.NEVER;
          }
          return e164;
        }),
      simType: z.enum(["esim", "physical"], { message: "Escolha eSIM ou chip físico." }),
      billingType: z.enum(["pix", "credit_card"], { message: "Escolha PIX ou cartão." }),
      whatsappOptIn: checked,
      /** Watch TV junto (D44): só se o cliente marcou. */
      watchTv: checked,
    })
    .strict();
}

export type CheckoutInput = z.infer<ReturnType<typeof checkoutInputSchema>>;

export type FieldErrors = Partial<Record<keyof CheckoutInput | "form", string>>;

export function parseCheckoutForm(
  data: Record<string, unknown>,
  today?: Date,
): { ok: true; value: CheckoutInput } | { ok: false; errors: FieldErrors } {
  const parsed = checkoutInputSchema(today).safeParse(data);
  if (parsed.success) return { ok: true, value: parsed.data };
  const errors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const key = (issue.path[0] as keyof CheckoutInput | undefined) ?? "form";
    errors[key] ??= issue.message;
  }
  return { ok: false, errors };
}

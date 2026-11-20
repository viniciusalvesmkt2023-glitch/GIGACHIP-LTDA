"use client";

import { useActionState } from "react";
import { buttonStyles } from "@/components/ui";
import { submitCheckout, type CheckoutFormState } from "../actions";

const initial: CheckoutFormState = { errors: {}, values: {} };

function Field({
  label, name, error, hint, ...input
}: { label: string; name: string; error?: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <input
        id={id}
        name={name}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        className={`mt-1 w-full rounded-xl border px-4 py-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 ${
          error ? "border-danger" : "border-border"
        }`}
        {...input}
      />
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-err`} className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}

function Choice({
  name, value, title, text, defaultChecked,
}: { name: string; value: string; title: string; text: string; defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-xl border border-border p-4 has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
      <input type="radio" name={name} value={value} defaultChecked={defaultChecked} className="mt-1 accent-[var(--brand)]" required />
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
    </label>
  );
}

export function CheckoutForm({ planSlug, allowEsim, allowPhysical }: { planSlug: string; allowEsim: boolean; allowPhysical: boolean }) {
  const [state, action, pending] = useActionState(submitCheckout, initial);
  const v = state.values;
  const e = state.errors;

  return (
    <form action={action} className="space-y-8" noValidate>
      <input type="hidden" name="planSlug" value={planSlug} />

      {e.form && (
        <p role="alert" className="rounded-xl border border-danger bg-red-50 p-4 text-sm text-danger">{e.form}</p>
      )}

      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Seus dados</legend>
        <Field label="Nome completo" name="fullName" autoComplete="name" defaultValue={v.fullName} error={e.fullName} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="CPF" name="cpf" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" defaultValue={v.cpf} error={e.cpf} required />
          <Field label="Data de nascimento" name="birthDate" type="date" autoComplete="bday" defaultValue={v.birthDate} error={e.birthDate} required />
        </div>
        <Field label="E-mail" name="email" type="email" autoComplete="email" defaultValue={v.email} error={e.email}
          hint="Enviaremos o passo a passo da ativação para este e-mail." required />
        <Field label="Celular para contato (WhatsApp)" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(00) 90000-0000"
          defaultValue={v.phone} error={e.phone} required />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-lg font-semibold">Tipo de ativação</legend>
        {allowEsim && (
          <Choice name="simType" value="esim" title="eSIM" text="Chip digital, instalado direto no celular. O aparelho precisa ser compatível."
            defaultChecked={v.simType === "esim"} />
        )}
        {allowPhysical && (
          <Choice name="simType" value="physical" title="Chip físico lacrado"
            text="Você compra um chip Vivo lacrado em uma loja e depois nos informa o número impresso nele."
            defaultChecked={v.simType === "physical"} />
        )}
        {e.simType && <p className="text-sm text-danger">{e.simType}</p>}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-lg font-semibold">Forma de pagamento</legend>
        <Choice name="billingType" value="pix" title="PIX" text="Pague na hora com o QR Code. Todo mês você recebe um novo PIX." defaultChecked={(v.billingType ?? "pix") === "pix"} />
        <Choice name="billingType" value="credit_card" title="Cartão de crédito" text="Cobrança automática todo mês no cartão." defaultChecked={v.billingType === "credit_card"} />
        {e.billingType && <p className="text-sm text-danger">{e.billingType}</p>}
      </fieldset>

      <fieldset className="space-y-3 text-sm">
        <label className="flex gap-3">
          <input type="checkbox" name="acceptTerms" defaultChecked={v.acceptTerms === "on"} className="mt-1 accent-[var(--brand)]" />
          <span>
            Li e aceito os <a href="/termos" target="_blank" className="font-medium text-brand underline">termos de uso</a> e as condições do contrato.
          </span>
        </label>
        {e.acceptTerms && <p className="text-danger">{e.acceptTerms}</p>}
        <label className="flex gap-3">
          <input type="checkbox" name="acceptPrivacy" defaultChecked={v.acceptPrivacy === "on"} className="mt-1 accent-[var(--brand)]" />
          <span>
            Li a <a href="/privacidade" target="_blank" className="font-medium text-brand underline">política de privacidade</a> e autorizo o uso dos meus dados para esta contratação.
          </span>
        </label>
        {e.acceptPrivacy && <p className="text-danger">{e.acceptPrivacy}</p>}
        <label className="flex gap-3 text-muted">
          <input type="checkbox" name="whatsappOptIn" defaultChecked={v.whatsappOptIn === "on"} className="mt-1 accent-[var(--brand)]" />
          <span>Quero receber avisos do meu pedido pelo WhatsApp (opcional).</span>
        </label>
      </fieldset>

      <button type="submit" disabled={pending} className={`${buttonStyles.primary} w-full py-4 text-base`}>
        {pending ? "Gerando pagamento..." : "Continuar para o pagamento"}
      </button>
    </form>
  );
}

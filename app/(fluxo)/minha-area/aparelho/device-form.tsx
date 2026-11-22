"use client";

import { useActionState } from "react";
import { buttonStyles } from "@/components/ui";
import { submitDevice, type DeviceFormState } from "./actions";

const initial: DeviceFormState = { errors: {}, values: {} };

function NumberField({ name, label, hint, error, defaultValue, maxLength }: {
  name: string; label: string; hint: string; error?: string; defaultValue?: string; maxLength: number;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium">{label}</label>
      <input
        id={name}
        name={name}
        inputMode="numeric"
        autoComplete="off"
        maxLength={maxLength}
        defaultValue={defaultValue}
        aria-invalid={!!error}
        aria-describedby={`${name}-help`}
        className={`mt-1 w-full rounded-xl border px-4 py-3 font-mono text-base tracking-wider outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 ${error ? "border-danger" : "border-border"}`}
      />
      <p id={`${name}-help`} className={`mt-1 text-sm ${error ? "text-danger" : "text-muted"}`}>{error ?? hint}</p>
    </div>
  );
}

export function DeviceForm({ simType }: { simType: "esim" | "physical" }) {
  const [state, action, pending] = useActionState(submitDevice, initial);
  const v = state.values;
  const e = state.errors;
  return (
    <form action={action} className="space-y-5">
      {e.form && <p role="alert" className="rounded-xl border border-danger bg-red-50 p-4 text-sm text-danger">{e.form}</p>}
      <NumberField name="imei" label="IMEI" hint="15 números. Se aparecerem dois IMEIs, use o IMEI 1." error={e.imei} defaultValue={v.imei} maxLength={20} />
      {simType === "esim" ? (
        <NumberField name="eid" label="EID" hint="32 números, começa com 89." error={e.eid} defaultValue={v.eid} maxLength={40} />
      ) : (
        <NumberField name="iccid" label="Número do chip (ICCID)" hint="19 ou 20 números impressos no cartão do chip, começa com 89." error={e.iccid} defaultValue={v.iccid} maxLength={25} />
      )}
      {state.needsConfirmation && (
        <div className="rounded-xl border border-accent bg-amber-50 p-4 text-sm">
          <p>{e.confirmWarnings}</p>
          <label className="mt-3 flex gap-2 font-medium">
            <input type="checkbox" name="confirmWarnings" className="mt-0.5 accent-[var(--brand)]" />
            Conferi e os números estão corretos.
          </label>
        </div>
      )}
      <button type="submit" disabled={pending} className={`${buttonStyles.primary} w-full py-4 text-base`}>
        {pending ? "Enviando..." : "Confirmar dados"}
      </button>
    </form>
  );
}

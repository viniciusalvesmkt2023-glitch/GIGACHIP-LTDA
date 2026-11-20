"use server";

import { redirect } from "next/navigation";
import { parseDeviceForm, type DeviceErrors } from "@/lib/domain/device-input";
import { currentOrderId } from "@/lib/server/customer-access";
import { getAreaView, saveDevice } from "@/lib/server/customer-area";

export type DeviceFormState = { errors: DeviceErrors; values: Record<string, string>; needsConfirmation?: boolean };

/** Ação pública: só age sobre o pedido do cookie de acesso deste navegador. */
export async function submitDevice(_prev: DeviceFormState, formData: FormData): Promise<DeviceFormState> {
  const values: Record<string, string> = {};
  for (const f of ["imei", "eid", "iccid", "confirmWarnings"] as const) {
    const v = formData.get(f);
    if (typeof v === "string") values[f] = v;
  }

  const orderId = await currentOrderId();
  const view = orderId ? await getAreaView(orderId) : null;
  if (!orderId || !view) return { errors: { form: "Sua sessão expirou. Abra novamente o link enviado ao seu e-mail." }, values };

  const parsed = parseDeviceForm(view.simType, values);
  if (!parsed.ok) return { errors: parsed.errors, values, needsConfirmation: parsed.needsConfirmation };

  const saved = await saveDevice(orderId, parsed.value);
  if (!saved.ok) {
    return { errors: { form: "Este pedido já está em ativação. Para corrigir os dados, fale com a gente pelo WhatsApp." }, values };
  }
  redirect("/minha-area");
}

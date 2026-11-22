"use server";

import { after } from "next/server";
import { parseDeviceForm, type DeviceErrors } from "@/lib/domain/device-input";
import { processQueuedContracts } from "@/lib/server/contracts";
import { currentOrderId } from "@/lib/server/customer-access";
import { getAreaView, saveDevice } from "@/lib/server/customer-area";

export type ActivationDeviceState = {
  ok?: boolean;
  errors: DeviceErrors & { print?: string };
  needsConfirmation?: boolean;
};

/** Ação pública: age só sobre o pedido do link/cookie deste navegador. */
export async function submitActivationDevice(formData: FormData): Promise<ActivationDeviceState> {
  const orderId = await currentOrderId();
  const view = orderId ? await getAreaView(orderId) : null;
  if (!orderId || !view) return { errors: { form: "Seu link expirou. Abra novamente o link enviado ao seu e-mail." } };

  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : undefined;
  };
  const print = formData.get("print");
  const screenshot = print instanceof File && print.size > 0 ? print : null;
  if (!screenshot) return { errors: { print: "Envie o print da tela com os números (*#06#)." } };

  const parsed = parseDeviceForm(view.simType, {
    imei: get("imei"),
    eid: get("eid"),
    iccid: get("iccid"),
    confirmWarnings: get("confirmWarnings"),
  });
  if (!parsed.ok) return { errors: parsed.errors, needsConfirmation: parsed.needsConfirmation };

  const r = await saveDevice(orderId, parsed.value, { screenshot, fromOcr: get("fromOcr") === "1" });
  if (!r.ok) {
    return {
      errors: r.code === "print_invalido"
        ? { print: "Não conseguimos ler esse arquivo. Envie o print como imagem (PNG ou JPG)." }
        : { form: "Este pedido já está em ativação. Para corrigir, fale com a gente." },
    };
  }
  // Envia o contrato logo depois de responder (a tela não espera a D4Sign)
  after(() => processQueuedContracts(1).then(() => undefined).catch((e) => console.error(`[contratos] ${e}`)));
  return { ok: true, errors: {} };
}

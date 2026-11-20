import { checkEid, checkIccid, isValidImei, onlyDigits } from "./validators";

export type DeviceInput = {
  imei: string;
  eid: string | null;
  iccid: string | null;
  /** Avisos de dígito verificador que o cliente confirmou estarem corretos. */
  warnings: ("eid_checksum" | "iccid_checksum")[];
};

export type DeviceErrors = Partial<Record<"imei" | "eid" | "iccid" | "confirmWarnings" | "form", string>>;

/**
 * Valida os dados do aparelho/chip (D4).
 * IMEI errado bloqueia. EID/ICCID com dígito verificador estranho só avisa: o cliente precisa
 * marcar "conferi e está correto" para enviar assim mesmo.
 */
export function parseDeviceForm(
  simType: "esim" | "physical",
  data: { imei?: string; eid?: string; iccid?: string; confirmWarnings?: string },
): { ok: true; value: DeviceInput } | { ok: false; errors: DeviceErrors; needsConfirmation?: boolean } {
  const errors: DeviceErrors = {};
  const imei = onlyDigits(data.imei ?? "");
  if (!isValidImei(imei)) errors.imei = "IMEI inválido. Confira os 15 números que aparecem ao digitar *#06#.";

  const warnings: DeviceInput["warnings"] = [];
  let eid: string | null = null;
  let iccid: string | null = null;

  if (simType === "esim") {
    eid = onlyDigits(data.eid ?? "");
    const c = checkEid(eid);
    if (!c.ok) errors.eid = "EID inválido. São 32 números começando com 89.";
    else if (!c.checksumOk) warnings.push("eid_checksum");
  } else {
    iccid = onlyDigits(data.iccid ?? "");
    const c = checkIccid(iccid);
    if (!c.ok) errors.iccid = "Número do chip inválido. São 19 ou 20 números começando com 89, impressos no cartão do chip.";
    else if (!c.checksumOk) warnings.push("iccid_checksum");
  }

  if (Object.keys(errors).length) return { ok: false, errors };

  const confirmed = data.confirmWarnings === "on";
  if (warnings.length && !confirmed) {
    return {
      ok: false,
      needsConfirmation: true,
      errors: {
        confirmWarnings:
          simType === "esim"
            ? "O EID parece ter algum número trocado. Confira com calma e, se estiver certo, marque a confirmação abaixo."
            : "O número do chip parece ter algum dígito trocado. Confira com calma e, se estiver certo, marque a confirmação abaixo.",
      },
    };
  }
  return { ok: true, value: { imei, eid, iccid, warnings } };
}

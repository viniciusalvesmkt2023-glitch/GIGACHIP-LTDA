import { describe, expect, it } from "vitest";
import { extractDeviceNumbers } from "@/lib/domain/ocr-extract";
import { luhnIsValid } from "@/lib/domain/validators";

const IMEI1 = "490154203237518";
const withLuhn = (p: string) => p + [...Array(10).keys()].find((d) => luhnIsValid(p + d));
const IMEI2 = withLuhn("35209900176148");
const eidFrom = (first30: string) => first30 + (BigInt(98) - (BigInt(first30 + "00") % BigInt(97))).toString().padStart(2, "0");
const EID = eidFrom("890490321234512345123456789012");
const ICCID = withLuhn("895510000000000001");

describe("leitura dos números no print", () => {
  it("print típico de iPhone (rótulos + número com espaços)", () => {
    const text = `IMEI\n${IMEI1.slice(0, 2)} ${IMEI1.slice(2, 8)} ${IMEI1.slice(8, 14)} ${IMEI1.slice(14)}\nEID\n${EID}\nOK`;
    expect(extractDeviceNumbers(text)).toEqual({ imeis: [IMEI1], eid: EID, iccid: null });
  });

  it("Android com dois IMEIs e EID quebrado em duas linhas", () => {
    const text = `IMEI1: ${IMEI1}\nIMEI2: ${IMEI2}\nEID:\n${EID.slice(0, 16)}\n${EID.slice(16)}`;
    const r = extractDeviceNumbers(text);
    expect(r.imeis).toEqual([IMEI1, IMEI2]);
    expect(r.eid).toBe(EID);
  });

  it("confusão de O com 0 e hífens", () => {
    const withO = IMEI1.replace(/0/g, "O");
    expect(extractDeviceNumbers(`IMEI ${withO.slice(0, 8)}-${withO.slice(8)}`).imeis).toEqual([IMEI1]);
  });

  it("foto do cartão do chip (ICCID)", () => {
    expect(extractDeviceNumbers(`VIVO\nICCID ${ICCID}\n`).iccid).toBe(ICCID);
  });

  it("número com dígito errado não é sugerido", () => {
    const bad = IMEI1.slice(0, 14) + ((Number(IMEI1[14]) + 1) % 10);
    expect(extractDeviceNumbers(`IMEI ${bad}`).imeis).toEqual([]);
  });

  it("texto sem números", () => {
    expect(extractDeviceNumbers("Configurações\nSobre")).toEqual({ imeis: [], eid: null, iccid: null });
  });
});

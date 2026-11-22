import { describe, expect, it } from "vitest";
import { parseDeviceForm } from "@/lib/domain/device-input";
import { luhnIsValid } from "@/lib/domain/validators";

const IMEI = "490154203237518";
const withLuhn = (p: string) => p + [...Array(10).keys()].find((d) => luhnIsValid(p + d));
const ICCID = withLuhn("895510000000000001");
const eidFrom = (first30: string) => first30 + (BigInt(98) - (BigInt(first30 + "00") % BigInt(97))).toString().padStart(2, "0");
const EID = eidFrom("890490321234512345123456789012");
const flip = (s: string) => s.slice(0, -1) + ((Number(s.at(-1)) + 1) % 10);

describe("dados do aparelho", () => {
  it("eSIM: IMEI + EID válidos", () => {
    const r = parseDeviceForm("esim", { imei: "49-015420-323751-8", eid: EID });
    expect(r).toEqual({ ok: true, value: { imei: IMEI, eid: EID, iccid: null, warnings: [] } });
  });
  it("chip físico: IMEI + ICCID válidos (EID ignorado)", () => {
    const r = parseDeviceForm("physical", { imei: IMEI, iccid: ICCID, eid: "123" });
    expect(r).toEqual({ ok: true, value: { imei: IMEI, eid: null, iccid: ICCID, warnings: [] } });
  });
  it("chip físico: só o ICCID basta (IMEI opcional — D38)", () => {
    const r = parseDeviceForm("physical", { iccid: ICCID });
    expect(r).toEqual({ ok: true, value: { imei: null, eid: null, iccid: ICCID, warnings: [] } });
    const ruim = parseDeviceForm("physical", { imei: flip(IMEI), iccid: ICCID });
    expect(!ruim.ok && ruim.errors.imei).toMatch(/IMEI inválido/);
  });
  it("eSIM continua exigindo o IMEI", () => {
    const r = parseDeviceForm("esim", { eid: EID });
    expect(!r.ok && r.errors.imei).toMatch(/IMEI inválido/);
  });
  it("IMEI errado bloqueia", () => {
    const r = parseDeviceForm("esim", { imei: flip(IMEI), eid: EID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.imei).toMatch(/IMEI inválido/);
  });
  it("formato de EID/ICCID errado bloqueia", () => {
    const a = parseDeviceForm("esim", { imei: IMEI, eid: "123" });
    const b = parseDeviceForm("physical", { imei: IMEI, iccid: "123" });
    expect(!a.ok && a.errors.eid).toBeTruthy();
    expect(!b.ok && b.errors.iccid).toBeTruthy();
  });
  it("dígito verificador estranho pede confirmação e depois aceita com aviso", () => {
    const sem = parseDeviceForm("physical", { imei: IMEI, iccid: flip(ICCID) });
    expect(sem.ok).toBe(false);
    if (!sem.ok) expect(sem.needsConfirmation).toBe(true);
    const com = parseDeviceForm("physical", { imei: IMEI, iccid: flip(ICCID), confirmWarnings: "on" });
    expect(com.ok && com.value.warnings).toEqual(["iccid_checksum"]);
  });
});

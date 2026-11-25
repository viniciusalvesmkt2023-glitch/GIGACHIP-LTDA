import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  cpfComPontos, evidenceFor, mapClicksignStatus, nomeParaClicksign, parseClicksignAuth, parseClicksignWebhook, verifyClicksignHmac,
} from "@/lib/integrations/clicksign/mapping";

describe("Clicksign (D45)", () => {
  it("mapeia a situação do documento", () => {
    expect(mapClicksignStatus("closed")).toBe("signed");
    expect(mapClicksignStatus("running")).toBe("sent");
    expect(mapClicksignStatus("canceled")).toBe("cancelled");
    expect(mapClicksignStatus("???")).toBeNull();
    expect(mapClicksignStatus(null)).toBeNull();
  });

  it("confere o HMAC do aviso (webhook) com o corpo cru", () => {
    const body = '{"event":{"name":"auto_close"},"document":{"key":"db4a2cf7-0a48-481f-b669-54f2a2260ac2"}}';
    const sig = createHmac("sha256", "segredo").update(body).digest("hex");
    expect(verifyClicksignHmac(body, `sha256=${sig}`, "segredo")).toBe(true);
    expect(verifyClicksignHmac(body, sig, "segredo")).toBe(true);
    expect(verifyClicksignHmac(body + " ", `sha256=${sig}`, "segredo")).toBe(false); // corpo alterado
    expect(verifyClicksignHmac(body, `sha256=${sig}`, "outro")).toBe(false);
    expect(verifyClicksignHmac(body, null, "segredo")).toBe(false);
    expect(verifyClicksignHmac(body, "sha256=zz", "segredo")).toBe(false);
  });

  it("lê o evento e a chave do documento do aviso", () => {
    expect(parseClicksignWebhook({ event: { name: "auto_close" }, document: { key: "DB4A2CF7-0A48-481F-B669-54F2A2260AC2" } })).toEqual({
      event: "auto_close",
      documentKey: "db4a2cf7-0a48-481f-b669-54f2a2260ac2",
    });
    expect(parseClicksignWebhook({ event: { name: "sign" }, document: { key: "nao-e-uuid" } }).documentKey).toBeNull();
    expect(parseClicksignWebhook(null)).toEqual({ event: null, documentKey: null });
  });

  it("biometria facial é o padrão; selfie + documento quando escolhido", () => {
    expect(parseClicksignAuth(undefined)).toBe("facial_biometrics");
    expect(parseClicksignAuth("qualquer")).toBe("facial_biometrics");
    expect(parseClicksignAuth("selfie_documento")).toBe("selfie_documento");
    expect(evidenceFor("facial_biometrics")).toEqual(["email", "facial_biometrics"]);
    expect(evidenceFor("selfie_documento")).toEqual(["email", "official_document", "selfie"]);
  });

  it("formata CPF e nome como a Clicksign pede", () => {
    expect(cpfComPontos("52998224725")).toBe("529.982.247-25");
    expect(nomeParaClicksign("  Maria   da Silva 2 ")).toBe("Maria da Silva");
    expect(nomeParaClicksign("Maria")).toBe("Maria Cliente");
  });
});

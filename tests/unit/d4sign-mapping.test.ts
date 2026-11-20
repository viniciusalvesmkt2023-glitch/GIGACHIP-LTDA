import { describe, expect, it } from "vitest";
import {
  documentUuidFromWebhook, mapDocumentStatus, parseDocumentResponse, retryDelayMinutes,
} from "@/lib/integrations/d4sign/mapping";

describe("status do documento na D4Sign", () => {
  it("lê objeto ou lista", () => {
    expect(parseDocumentResponse([{ statusId: "4", statusName: "Finalizado" }])).toEqual({ statusId: "4", statusName: "Finalizado" });
    expect(parseDocumentResponse({ statusId: 3, statusName: "Aguardando Assinaturas" })).toEqual({ statusId: "3", statusName: "Aguardando Assinaturas" });
    expect(parseDocumentResponse(null)).toEqual({ statusId: null, statusName: null });
  });
  it("mapeia finalizado, cancelado e aguardando", () => {
    expect(mapDocumentStatus({ statusId: "4", statusName: null })).toBe("signed");
    expect(mapDocumentStatus({ statusId: null, statusName: "Finalizado" })).toBe("signed");
    expect(mapDocumentStatus({ statusId: "6", statusName: "Cancelado" })).toBe("cancelled");
    expect(mapDocumentStatus({ statusId: "3", statusName: "Aguardando Assinaturas" })).toBe("sent");
    expect(mapDocumentStatus({ statusId: "99", statusName: "???" })).toBeNull();
  });
});

describe("aviso (webhook) da D4Sign", () => {
  it("aceita só uuid válido", () => {
    expect(documentUuidFromWebhook({ uuid: "6A7F0E1C-2B3D-4E5F-8A9B-0C1D2E3F4A5B", type_post: "1" })).toBe("6a7f0e1c-2b3d-4e5f-8a9b-0c1d2e3f4a5b");
    expect(documentUuidFromWebhook({ uuid: "'; drop table" })).toBeNull();
    expect(documentUuidFromWebhook({})).toBeNull();
  });
});

describe("novas tentativas", () => {
  it("espera cresce e tem teto de 24 h", () => {
    expect([1, 2, 3, 4].map(retryDelayMinutes)).toEqual([15, 30, 60, 120]);
    expect(retryDelayMinutes(20)).toBe(1440);
  });
});

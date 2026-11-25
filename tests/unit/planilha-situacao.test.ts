import { describe, expect, it } from "vitest";
import {
  EXPECTED_SCHEMA,
  SHEET_STUCK_AFTER_MS,
  isMissingSchemaError,
  missingMigrations,
  sheetErrorMessage,
  sheetWriteState,
} from "@/lib/domain/planilha";

const now = new Date("2026-11-21T19:20:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

describe("sheetWriteState", () => {
  it("erro vence tudo", () => {
    expect(sheetWriteState({ pending: true, error: "falhou", updatedAt: ago(1000) }, now)).toBe("erro");
    expect(sheetWriteState({ pending: false, error: "falhou", syncedAt: ago(1000) }, now)).toBe("erro");
  });
  it("pendente há pouco tempo = escrevendo", () => {
    expect(sheetWriteState({ pending: true, error: null, updatedAt: ago(30_000) }, now)).toBe("escrevendo");
  });
  it("pendente há muito tempo sem erro = na fila (não fica 'escrevendo' para sempre)", () => {
    expect(sheetWriteState({ pending: true, error: null, updatedAt: ago(SHEET_STUCK_AFTER_MS + 1) }, now)).toBe("na_fila");
    // GC-2026-00005: ativado às 19:13:50 e ainda pendente às 19:20
    expect(sheetWriteState({ pending: true, error: null, updatedAt: "2026-11-21T19:13:50Z" }, now)).toBe("na_fila");
  });
  it("sem data de atualização = na fila", () => {
    expect(sheetWriteState({ pending: true, error: null, updatedAt: null }, now)).toBe("na_fila");
  });
  it("escrita com sucesso = ok; nunca escrita = nenhum", () => {
    expect(sheetWriteState({ pending: false, error: null, syncedAt: ago(5000) }, now)).toBe("ok");
    expect(sheetWriteState({ pending: false, error: null, syncedAt: null }, now)).toBe("nenhum");
  });
});

describe("mensagens de erro da planilha", () => {
  it("reconhece migração faltando (pelo código ou pela mensagem)", () => {
    expect(isMissingSchemaError(Object.assign(new Error("x"), { code: "42703" }))).toBe(true);
    expect(isMissingSchemaError(new Error('column l.sheet_overwrite does not exist'))).toBe(true);
    expect(isMissingSchemaError(new Error('relation "public.line_blocks" does not exist'))).toBe(true);
    expect(isMissingSchemaError(new Error("PERMISSION_DENIED"))).toBe(false);
  });
  it("diz o que fazer quando falta migração", () => {
    expect(sheetErrorMessage(new Error("column l.sheet_overwrite does not exist"))).toMatch(/Falta rodar uma migração/);
  });
  it("nunca mostra números longos (ICCID, IMEI, EID, CPF)", () => {
    const m = sheetErrorMessage(new Error("Key (iccid)=(8955109300000000005) already exists; cpf 12345678901"));
    expect(m).not.toMatch(/8955109300000000005|12345678901/);
    expect(m).toContain("•••");
  });
  it("corta mensagens muito longas", () => {
    expect(sheetErrorMessage(new Error("a".repeat(1000))).length).toBeLessThanOrEqual(301);
  });
});

describe("missingMigrations", () => {
  const all = new Set(EXPECTED_SCHEMA.flatMap((m) => m.objects));
  it("banco em dia = nada pendente", () => {
    expect(missingMigrations(all)).toEqual([]);
  });
  it("sem a coluna sheet_overwrite = aponta a 0014", () => {
    const present = new Set([...all].filter((o) => o !== "lines.sheet_overwrite"));
    expect(missingMigrations(present)).toEqual([
      { file: "20261121000014_editar_linha.sql", missing: ["lines.sheet_overwrite"] },
    ]);
  });
  it("sem a coluna image_kind = aponta a 0015 (chip físico sem IMEI)", () => {
    const present = new Set([...all].filter((o) => o !== "device_info.image_kind"));
    expect(missingMigrations(present).map((m) => m.file)).toEqual(["20261122000015_chip_fisico_sem_imei.sql"]);
  });
  it("lista várias na ordem", () => {
    const r = missingMigrations(new Set(["overdue_payments", "line_blocks", "lines.asaas_customer_id"]));
    expect(r.map((m) => m.file.slice(0, 16))).toEqual([
      "20261120000002_b", "20261121000011_p", "20261121000012_p", "20261121000013_r", "20261121000014_e", "20261122000015_c", "20261124000016_w", "20261125000017_c",
    ]);
  });
});

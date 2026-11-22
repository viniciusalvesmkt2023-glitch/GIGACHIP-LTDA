import { describe, expect, it } from "vitest";
import { diasEntre, parsePeriodo } from "@/lib/domain/periodo";

const hoje = "2026-11-22";

describe("parsePeriodo", () => {
  it("padrão = últimos 7 dias, incluindo hoje", () => {
    expect(parsePeriodo({}, hoje)).toMatchObject({ chave: "7", de: "2026-11-16", ate: hoje, agrupar: "dia" });
  });
  it("hoje agrupa por hora", () => {
    expect(parsePeriodo({ periodo: "hoje" }, hoje)).toMatchObject({ de: hoje, ate: hoje, agrupar: "hora" });
  });
  it("30 dias", () => {
    const p = parsePeriodo({ periodo: "30" }, hoje);
    expect(p.de).toBe("2026-10-24");
    expect(diasEntre(p.de, p.ate)).toBe(30);
  });
  it("personalizado: inverte datas trocadas e não passa de hoje", () => {
    expect(parsePeriodo({ periodo: "personalizado", de: "2026-12-10", ate: "2026-11-01" }, hoje)).toMatchObject({
      de: "2026-11-01",
      ate: hoje,
      rotulo: "01/11/2026 a 22/11/2026",
    });
  });
  it("personalizado de um dia só agrupa por hora", () => {
    expect(parsePeriodo({ periodo: "personalizado", de: "2026-11-20", ate: "2026-11-20" }, hoje)).toMatchObject({ agrupar: "hora" });
  });
  it("limita a 366 dias", () => {
    const p = parsePeriodo({ periodo: "personalizado", de: "2020-01-01", ate: "2026-11-22" }, hoje);
    expect(diasEntre(p.de, p.ate)).toBe(366);
  });
  it("data inválida volta para 7 dias", () => {
    expect(parsePeriodo({ periodo: "personalizado", de: "2026-02-31", ate: "x" }, hoje).chave).toBe("7");
  });
});

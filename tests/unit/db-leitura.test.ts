import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("consulta só de leitura (pode ser repetida numa conexão nova)", async () => {
  const { isReadOnlyQuery } = await import("@/lib/server/db");
  it("select e with simples são leitura", () => {
    expect(isReadOnlyQuery("select status::text, count(*) from public.orders group by status")).toBe(true);
    expect(isReadOnlyQuery("\n    with janela as (select 1) select * from janela")).toBe(true);
  });
  it("qualquer escrita, trava de linha ou sequência não é repetida", () => {
    expect(isReadOnlyQuery("update public.lines set sheet_pending = true")).toBe(false);
    expect(isReadOnlyQuery("insert into public.audit_log values (?)")).toBe(false);
    expect(isReadOnlyQuery("with x as (update public.orders set a = 1 returning *) select * from x")).toBe(false);
    expect(isReadOnlyQuery("select * from public.orders where id = ? for update")).toBe(false);
    expect(isReadOnlyQuery("select set_config('gc.actor_type', ?, true)")).toBe(false);
  });
});

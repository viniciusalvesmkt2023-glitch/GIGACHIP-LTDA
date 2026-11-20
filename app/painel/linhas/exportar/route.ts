import { linesCsv } from "@/lib/server/lines";
import { requireStaff } from "@/lib/server/staff-auth";
import { sql } from "@/lib/server/db";

/** Baixa o estoque de linhas no formato da planilha (CSV que o Excel abre). Auditado. */
export async function GET() {
  const me = await requireStaff(["owner", "admin", "financeiro"]);
  const csv = await linesCsv();
  await sql()`insert into public.audit_log (actor_id, action, entity) values (${me.id}, 'exportar_planilha_linhas', 'lines')`;
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="linhas-gigachip-${date}.csv"`,
      "Cache-Control": "no-store, private",
    },
  });
}

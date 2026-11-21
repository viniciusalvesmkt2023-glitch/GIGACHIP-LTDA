import "server-only";
import { EXPECTED_SCHEMA, missingMigrations } from "@/lib/domain/planilha";
import { sql } from "./db";

/**
 * Confere no banco se as migrações recentes foram rodadas (Painel → Integrações).
 * Só lê o catálogo (information_schema); não mexe em nada.
 */
export async function pendingMigrations(): Promise<{ file: string; missing: string[] }[]> {
  const tables = [...new Set(EXPECTED_SCHEMA.flatMap((m) => m.objects.map((o) => o.split(".")[0]!)))];
  const [tbl, cols] = await Promise.all([
    sql()<{ table_name: string }[]>`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_name = any(${tables})`,
    sql()<{ table_name: string; column_name: string }[]>`
      select table_name, column_name from information_schema.columns
      where table_schema = 'public' and table_name = any(${tables})`,
  ]);
  const present = new Set<string>([
    ...tbl.map((t) => t.table_name),
    ...cols.map((c) => `${c.table_name}.${c.column_name}`),
  ]);
  return missingMigrations(present);
}

import "server-only";
import postgres from "postgres";
import { env } from "./env";

/**
 * Conexão direta com o Postgres (Supabase) — só no servidor, com credencial de serviço.
 * No Supabase use a URL do "Transaction pooler" (porta 6543); por isso prepare: false.
 */

type Sql = postgres.Sql;

const globalForDb = globalThis as unknown as { __gcSql?: Sql };

export function sql(): Sql {
  if (!globalForDb.__gcSql) {
    globalForDb.__gcSql = postgres(env().DATABASE_URL, {
      prepare: false,
      max: 5,
      idle_timeout: 20,
      types: { bigint: postgres.BigInt },
    });
  }
  return globalForDb.__gcSql;
}

export type ActorType = "system" | "customer" | "staff" | "webhook";
export type Tx = postgres.TransactionSql;

/**
 * Executa uma transação registrando quem está agindo. Os triggers do banco usam esses valores
 * para preencher o histórico do pedido (order_events).
 */
export async function withActor<T>(
  actor: { type: ActorType; id?: string | null; reason?: string | null },
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return sql().begin(async (tx) => {
    await tx`select set_config('gc.actor_type', ${actor.type}, true),
                    set_config('gc.actor_id', ${actor.id ?? ""}, true),
                    set_config('gc.reason', ${actor.reason ?? ""}, true)`;
    return fn(tx);
  }) as Promise<T>;
}

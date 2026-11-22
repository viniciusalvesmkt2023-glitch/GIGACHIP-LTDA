import "server-only";
import postgres from "postgres";
import { env } from "./env";

/**
 * Conexão direta com o Postgres (Supabase) — só no servidor, com credencial de serviço.
 * No Supabase use a URL do "Transaction pooler" (porta 6543); por isso prepare: false.
 */

type Sql = postgres.Sql;

const globalForDb = globalThis as unknown as { __gcSql?: Sql; __gcRaw?: Sql };

/** Tempo máximo de uma consulta e de uma transação antes de desistir (e trocar as conexões). */
const QUERY_TIMEOUT_MS = 15_000;
const TRANSACTION_TIMEOUT_MS = 30_000;

export class DatabaseTimeoutError extends Error {}

/**
 * Já aconteceu, em produção, de uma conexão entre a Vercel e o Supabase ficar "pendurada" no meio
 * de uma consulta (no banco aparece como ClientRead). As consultas seguintes ficavam na fila atrás
 * dela e o painel ficava em "Carregando…" para sempre. Agora, se o banco não responder no tempo
 * limite, a consulta falha com erro e TODAS as conexões são trocadas por novas — a próxima
 * tentativa (ex.: atualizar a página) já funciona.
 */
function resetPool(reason: string) {
  const old = globalForDb.__gcRaw;
  globalForDb.__gcRaw = undefined;
  globalForDb.__gcSql = undefined;
  console.error(`[db] ${reason}: conexões descartadas e recriadas`);
  old?.end({ timeout: 0 }).catch(() => undefined);
}

function withTimeout<T>(work: PromiseLike<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      resetPool(`${what} sem resposta em ${ms / 1000} s`);
      reject(new DatabaseTimeoutError("O banco de dados não respondeu a tempo. Tente de novo."));
    }, ms);
  });
  return Promise.race([Promise.resolve(work), timeout]).finally(() => clearTimeout(timer));
}

function guarded(raw: Sql): Sql {
  return new Proxy(raw, {
    // sql`...` → consulta com tempo limite
    apply(target, thisArg, args) {
      // No log vai só o começo do texto da consulta (sem os valores), para saber qual travou
      const texto = Array.isArray(args[0]) ? (args[0] as string[]).join("?").replace(/\s+/g, " ").trim().slice(0, 90) : "";
      return withTimeout(Reflect.apply(target, thisArg, args) as PromiseLike<unknown>, QUERY_TIMEOUT_MS, `consulta [${texto}]`);
    },
    get(target, prop, receiver) {
      if (prop === "begin") {
        return (...args: unknown[]) =>
          withTimeout((target.begin as (...a: unknown[]) => PromiseLike<unknown>)(...args), TRANSACTION_TIMEOUT_MS, "transação");
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as Sql;
}

export function sql(): Sql {
  if (!globalForDb.__gcSql) {
    globalForDb.__gcRaw = postgres(env().DATABASE_URL, {
      prepare: false,
      max: 5,
      idle_timeout: 20,
      // Desiste de conectar após 10 s e renova cada conexão a cada 5 min.
      connect_timeout: 10,
      max_lifetime: 60 * 5,
      types: { bigint: postgres.BigInt },
    });
    globalForDb.__gcSql = guarded(globalForDb.__gcRaw);
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

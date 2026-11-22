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
/** Leitura que passar disso é tentada de novo, uma vez, numa conexão nova (leituras são rápidas). */
const READ_RETRY_AFTER_MS = 6_000;

export class DatabaseTimeoutError extends Error {}

/**
 * Já aconteceu, em produção, de uma conexão entre a Vercel e o Supabase ficar "pendurada" no meio
 * de uma consulta (no banco aparece como ClientRead). As consultas seguintes ficavam na fila atrás
 * dela e o painel ficava em "Carregando…" para sempre. Agora:
 * - leitura (select/with sem insert/update/delete) sem resposta em 6 s → troca as conexões e tenta
 *   de novo uma vez numa conexão nova;
 * - qualquer outra consulta sem resposta em 15 s → falha com erro e troca as conexões.
 * As conexões antigas recebem até 10 s para terminar o que estavam fazendo (antes eram cortadas
 * na hora, e as consultas saudáveis do mesmo momento falhavam junto).
 */
function resetPool(reason: string) {
  const old = globalForDb.__gcRaw;
  globalForDb.__gcRaw = undefined;
  console.error(`[db] ${reason}: conexões trocadas por novas`);
  old?.end({ timeout: 10 }).catch(() => undefined);
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

/** Pool de conexões atual (recriado depois de uma troca). */
function raw(): Sql {
  if (!globalForDb.__gcRaw) {
    globalForDb.__gcRaw = postgres(env().DATABASE_URL, {
      prepare: false,
      max: 5,
      // Fecha logo as conexões paradas: na Vercel a função "dorme" entre os acessos e uma conexão
      // parada pode ficar morta sem aviso (era ela que travava o painel)
      idle_timeout: 5,
      // Desiste de conectar após 10 s e renova cada conexão a cada 5 min.
      connect_timeout: 10,
      max_lifetime: 60 * 5,
      types: { bigint: postgres.BigInt },
    });
  }
  return globalForDb.__gcRaw;
}

/** Só leitura (pode ser repetida sem efeito colateral). */
export function isReadOnlyQuery(text: string): boolean {
  return /^\s*(select|with)\b/i.test(text) && !/\b(insert|update|delete|for\s+update|nextval|set_config)\b/i.test(text);
}

function guarded(): Sql {
  // O alvo é só um "molde": cada chamada usa o pool atual (que pode ter sido trocado)
  return new Proxy(function () {} as unknown as Sql, {
    // sql`...` → consulta com tempo limite (e nova tentativa, se for leitura)
    apply(_target, thisArg, args) {
      const full = Array.isArray(args[0]) ? (args[0] as string[]).join("?") : "";
      // No log vai só o começo do texto da consulta (sem os valores), para saber qual travou
      const texto = full.replace(/\s+/g, " ").trim().slice(0, 90);
      const run = (ms: number) => withTimeout(Reflect.apply(raw(), thisArg, args) as PromiseLike<unknown>, ms, `consulta [${texto}]`);
      if (!isReadOnlyQuery(full)) return run(QUERY_TIMEOUT_MS);
      return run(READ_RETRY_AFTER_MS).catch((e: unknown) => {
        if (!(e instanceof DatabaseTimeoutError)) throw e;
        console.error(`[db] tentando de novo numa conexão nova: [${texto}]`);
        return run(QUERY_TIMEOUT_MS);
      });
    },
    get(_target, prop) {
      const r = raw();
      if (prop === "begin") {
        return (...args: unknown[]) =>
          withTimeout((r.begin as (...a: unknown[]) => PromiseLike<unknown>)(...args), TRANSACTION_TIMEOUT_MS, "transação");
      }
      const v = Reflect.get(r, prop, r);
      return typeof v === "function" ? v.bind(r) : v;
    },
  });
}

export function sql(): Sql {
  if (!globalForDb.__gcSql) globalForDb.__gcSql = guarded();
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

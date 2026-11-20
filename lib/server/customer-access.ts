import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { sql, type Tx } from "./db";

/**
 * Acesso do cliente à "Minha área" sem senha.
 * - Na compra, o navegador recebe um cookie httpOnly com um token aleatório.
 * - Em outro aparelho, o cliente usa o link enviado por e-mail (/acesso/<token>).
 * Só o hash do token fica no banco. O token nunca aparece em logs.
 */

export const ACCESS_COOKIE = "gc_area";
const TOKEN_DAYS = 30;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function issueAccessToken(tx: Tx, orderId: string, via: "checkout" | "email"): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await tx`
    insert into public.order_access_tokens (order_id, token_hash, created_via, expires_at)
    values (${orderId}, ${hashToken(token)}, ${via}, now() + make_interval(days => ${TOKEN_DAYS}))`;
  return token;
}

/** Grava o cookie de acesso (só pode ser chamado em Server Action ou Route Handler). */
export async function setAccessCookie(token: string): Promise<void> {
  (await cookies()).set(ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TOKEN_DAYS * 24 * 60 * 60,
  });
}

/** Valida um token e retorna o pedido a que ele dá acesso. */
export async function orderIdFromToken(token: string | undefined | null): Promise<string | null> {
  if (!token || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const [row] = await sql()<{ order_id: string }[]>`
    update public.order_access_tokens
    set last_used_at = now()
    where token_hash = ${hashToken(token)} and revoked_at is null and expires_at > now()
    returning order_id`;
  return row?.order_id ?? null;
}

/** Pedido do cliente no navegador atual (pelo cookie). */
export async function currentOrderId(): Promise<string | null> {
  return orderIdFromToken((await cookies()).get(ACCESS_COOKIE)?.value);
}

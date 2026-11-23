import "server-only";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { sql, withActor } from "./db";
import { env } from "./env";
import { emailConfigured, renderLoginCodeEmail, sendEmailNow } from "./email";
import { issueAccessToken, setAccessCookie } from "./customer-access";

/**
 * Área do Cliente: entrar com código de 6 números enviado por e-mail (D42).
 * - O desafio fica num cookie assinado (HMAC) — o código nunca é guardado, nem em texto nem no banco.
 * - Limites contados no audit_log (só inserção): 5 envios por e-mail por hora, 20 por IP por hora e
 *   5 tentativas erradas por código. A resposta é sempre igual (não revela quem é cliente).
 */

const LOGIN_COOKIE = "gc_login";
const CODE_MINUTES = 10;
const MAX_SENDS_PER_EMAIL = 5;
const MAX_SENDS_PER_IP = 20;
const MAX_TRIES = 5;

const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const emailKey = (email: string) => sha(`email:${email.trim().toLowerCase()}`);
const sign = (data: string) => createHmac("sha256", env().CPF_HASH_KEY).update(`area-cliente:${data}`).digest("base64url");

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  return ip && /^[0-9a-f.:]+$/i.test(ip) ? ip : null;
}

async function countAudit(action: string, field: "entity_id" | "ip", value: string, minutes: number): Promise<number> {
  const [r] =
    field === "entity_id"
      ? await sql()<{ n: number }[]>`
          select count(*)::int as n from public.audit_log
          where action = ${action} and entity = 'area_cliente' and entity_id = ${value} and created_at > now() - make_interval(mins => ${minutes})`
      : await sql()<{ n: number }[]>`
          select count(*)::int as n from public.audit_log
          where action = ${action} and entity = 'area_cliente' and ip = ${value}::inet and created_at > now() - make_interval(mins => ${minutes})`;
  return r?.n ?? 0;
}

async function audit(action: string, entityId: string, ip: string | null) {
  await sql()`
    insert into public.audit_log (actor_id, action, entity, entity_id, metadata, ip)
    values (null, ${action}, 'area_cliente', ${entityId}, '{}'::jsonb, ${ip}::inet)`;
}

export type LoginResult = { ok: boolean; message: string };

/** Passo 1: manda o código para o e-mail (se for de um cliente). Resposta sempre igual. */
export async function requestLoginCode(rawEmail: string): Promise<LoginResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) return { ok: false, message: "Digite um e-mail válido." };
  const ip = await clientIp();
  const key = emailKey(email);
  const generic: LoginResult = { ok: true, message: "Se este e-mail for de um cliente Gigachip, enviamos um código de 6 números. Confira também o spam." };

  if ((await countAudit("cliente_codigo_enviado", "entity_id", key, 60)) >= MAX_SENDS_PER_EMAIL) {
    return { ok: false, message: "Muitos pedidos de código para este e-mail. Espere 1 hora ou fale com a gente no WhatsApp." };
  }
  if (ip && (await countAudit("cliente_codigo_enviado", "ip", ip, 60)) >= MAX_SENDS_PER_IP) {
    return { ok: false, message: "Muitas tentativas. Espere um pouco e tente de novo." };
  }

  const [customer] = await sql()<{ full_name: string }[]>`
    select c.full_name from public.customers c
    where c.email = ${email} and exists (select 1 from public.orders o where o.customer_id = c.id)
    limit 1`;

  const challenge = randomBytes(12).toString("base64url");
  const exp = Date.now() + CODE_MINUTES * 60_000;
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  // Sem cliente: assina um código que ninguém recebe (a tela e o tempo de resposta ficam iguais)
  const sig = sign(`${challenge}|${exp}|${key}|${customer ? code : randomBytes(8).toString("hex")}`);
  (await cookies()).set(LOGIN_COOKIE, `${challenge}.${exp}.${key}.${sig}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CODE_MINUTES * 60,
  });
  await audit("cliente_codigo_enviado", key, ip);

  if (customer) {
    if (!emailConfigured()) return { ok: false, message: "Não conseguimos enviar e-mails agora. Fale com a gente no WhatsApp." };
    try {
      await sendEmailNow(email, renderLoginCodeEmail({ firstName: customer.full_name.split(/\s+/)[0] ?? "", code }));
    } catch (e) {
      console.error(`[area-cliente] falha ao enviar código: ${e instanceof Error ? e.message : e}`);
      return { ok: false, message: "Não conseguimos enviar o e-mail agora. Tente de novo em alguns minutos." };
    }
  }
  return generic;
}

/** Passo 2: confere o código e libera o acesso ao pedido mais recente do cliente. */
export async function verifyLoginCode(rawCode: string): Promise<LoginResult> {
  const code = rawCode.replace(/\D/g, "");
  const jar = await cookies();
  const raw = jar.get(LOGIN_COOKIE)?.value ?? "";
  const [challenge, expStr, key, sig] = raw.split(".");
  const exp = Number(expStr);
  if (!challenge || !key || !sig || !Number.isFinite(exp) || Date.now() > exp) {
    return { ok: false, message: "O código venceu. Peça um código novo." };
  }
  if (!/^\d{6}$/.test(code)) return { ok: false, message: "Digite os 6 números do código." };
  const ip = await clientIp();
  const tries = await countAudit("cliente_codigo_errado", "entity_id", challenge, CODE_MINUTES + 1);
  if (tries >= MAX_TRIES || (await countAudit("cliente_codigo_usado", "entity_id", challenge, CODE_MINUTES + 1)) > 0) {
    return { ok: false, message: "Este código não vale mais. Peça um código novo." };
  }
  const expected = Buffer.from(sign(`${challenge}|${exp}|${key}|${code}`));
  if (expected.length !== Buffer.from(sig).length || !timingSafeEqual(expected, Buffer.from(sig))) {
    await audit("cliente_codigo_errado", challenge, ip);
    const left = MAX_TRIES - tries - 1;
    return { ok: false, message: left > 0 ? `Código errado. Você ainda tem ${left} tentativa${left > 1 ? "s" : ""}.` : "Código errado. Peça um código novo." };
  }

  // Pedido mais recente do cliente (de preferência um já pago)
  const [order] = await sql()<{ id: string }[]>`
    select o.id from public.orders o join public.customers c on c.id = o.customer_id
    where encode(sha256(convert_to('email:' || lower(c.email::text), 'UTF8')), 'hex') = ${key}
    order by (o.payment_status in ('confirmed', 'received')) desc, o.created_at desc
    limit 1`;
  if (!order) return { ok: false, message: "Não achamos pedidos neste e-mail. Fale com a gente no WhatsApp." };

  const token = await withActor({ type: "customer", reason: "entrou na área do cliente com código por e-mail" }, (tx) =>
    issueAccessToken(tx, order.id, "email"),
  );
  await audit("cliente_codigo_usado", challenge, ip);
  await setAccessCookie(token);
  jar.delete(LOGIN_COOKIE);
  return { ok: true, message: "Pronto!" };
}

/** Troca para outro pedido do MESMO cliente (quem tem mais de uma linha). */
export async function switchOrder(currentOrderId: string, targetOrderId: string): Promise<boolean> {
  const [same] = await sql()<{ ok: boolean }[]>`
    select true as ok from public.orders a join public.orders b on b.customer_id = a.customer_id
    where a.id = ${currentOrderId} and b.id = ${targetOrderId}`;
  if (!same) return false;
  const token = await withActor({ type: "customer", reason: "trocou de pedido na área do cliente" }, (tx) => issueAccessToken(tx, targetOrderId, "email"));
  await setAccessCookie(token);
  return true;
}

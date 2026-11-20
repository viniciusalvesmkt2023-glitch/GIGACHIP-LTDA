import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { generateTotpSecret, hashPassword, passwordProblem, verifyPassword, verifyTotp } from "./auth-crypto";
import { decryptField, encryptField } from "./crypto";
import { sql } from "./db";
import { env } from "./env";

/**
 * Login da equipe: e-mail + senha + 2FA (aplicativo autenticador) OBRIGATÓRIO.
 * Sessão em cookie httpOnly; só o hash do token fica no banco.
 */

export type StaffRole = "owner" | "admin" | "ativador" | "atendente" | "financeiro";
export type Staff = { id: string; name: string; email: string; role: StaffRole };

const COOKIE = "gc_staff";
const SESSION_HOURS = 12;
const MAX_FAILS = 5;
const FAIL_WINDOW_MIN = 15;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

async function requestMeta() {
  const h = await headers();
  return { ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || null, userAgent: h.get("user-agent") };
}

async function audit(actorId: string | null, action: string, entityId: string | null, metadata: object = {}) {
  const { ip } = await requestMeta();
  await sql()`
    insert into public.audit_log (actor_id, action, entity, entity_id, metadata, ip)
    values (${actorId}, ${action}, 'staff', ${entityId}, ${sql().json(metadata as never)}, ${ip})`;
}

// ------------------------------------------------------------------ sessão

type SessionRow = Staff & { session_id: string; mfa_verified: boolean; has_totp: boolean };

async function loadSession(): Promise<SessionRow | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const [row] = await sql()<SessionRow[]>`
    update public.staff_sessions ss set last_seen_at = now()
    from public.staff s
    where ss.token_hash = ${sha256(token)} and ss.staff_id = s.id
      and ss.revoked_at is null and ss.expires_at > now() and s.is_active
    returning s.id, s.name, s.email::text as email, s.role::text as role,
              ss.id as session_id, ss.mfa_verified, (s.totp_secret_encrypted is not null) as has_totp`;
  return row ?? null;
}

/** Exige equipe logada com 2FA confirmado (e, opcionalmente, uma das funções). */
export async function requireStaff(roles?: StaffRole[]): Promise<Staff> {
  const s = await loadSession();
  if (!s) redirect("/painel/entrar");
  if (!s.mfa_verified) redirect("/painel/2fa");
  if (roles && !roles.includes(s.role)) redirect("/painel?sem-permissao=1");
  return { id: s.id, name: s.name, email: s.email, role: s.role };
}

/** Sessão aguardando o 2FA (para a tela de 2FA). */
export async function pendingMfaSession(): Promise<{ staff: Staff; hasTotp: boolean } | null> {
  const s = await loadSession();
  if (!s) return null;
  return { staff: { id: s.id, name: s.name, email: s.email, role: s.role }, hasTotp: s.has_totp };
}

// ------------------------------------------------------------------ login

export type LoginResult = { ok: true } | { ok: false; message: string };

export async function login(email: string, password: string): Promise<LoginResult> {
  const { ip, userAgent } = await requestMeta();
  const normalized = email.trim().toLowerCase();

  const [{ fails }] = await sql()<{ fails: number }[]>`
    select count(*)::int as fails from public.staff_login_attempts
    where email = ${normalized} and not success
      and created_at > now() - make_interval(mins => ${FAIL_WINDOW_MIN})`;
  if (fails >= MAX_FAILS) {
    return { ok: false, message: `Muitas tentativas. Aguarde ${FAIL_WINDOW_MIN} minutos e tente de novo.` };
  }

  const [staff] = await sql()<{ id: string; password_hash: string | null }[]>`
    select id, password_hash from public.staff where email = ${normalized} and is_active`;
  const ok = await verifyPassword(password, staff?.password_hash ?? null);
  await sql()`insert into public.staff_login_attempts (email, ip, success) values (${normalized}, ${ip}, ${ok})`;
  if (!ok || !staff) return { ok: false, message: "E-mail ou senha incorretos." };

  const token = randomBytes(32).toString("base64url");
  await sql()`
    insert into public.staff_sessions (staff_id, token_hash, ip, user_agent, expires_at)
    values (${staff.id}, ${sha256(token)}, ${ip}, ${userAgent}, now() + make_interval(hours => ${SESSION_HOURS}))`;
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  await audit(staff.id, "staff_login_senha", staff.id);
  return { ok: true };
}

export async function logout(): Promise<void> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (token) await sql()`update public.staff_sessions set revoked_at = now() where token_hash = ${sha256(token)}`;
  (await cookies()).delete(COOKIE);
}

// ------------------------------------------------------------------ 2FA

/** Gera (ou reaproveita) o segredo pendente para cadastrar o autenticador. */
export async function startTotpEnrollment(staffId: string): Promise<string> {
  const key = env().FIELD_ENCRYPTION_KEY;
  const [row] = await sql()<{ pending: Uint8Array | null }[]>`
    select totp_pending_encrypted as pending from public.staff where id = ${staffId}`;
  if (row?.pending) return decryptField(row.pending, key);
  const secret = generateTotpSecret();
  await sql()`update public.staff set totp_pending_encrypted = ${encryptField(secret, key)} where id = ${staffId}`;
  return secret;
}

export async function verifySecondFactor(code: string): Promise<LoginResult> {
  const s = await loadSession();
  if (!s) return { ok: false, message: "Sessão expirada. Entre novamente." };
  const key = env().FIELD_ENCRYPTION_KEY;
  const [row] = await sql()<{ active: Uint8Array | null; pending: Uint8Array | null }[]>`
    select totp_secret_encrypted as active, totp_pending_encrypted as pending from public.staff where id = ${s.id}`;
  const enrolling = !row.active;
  const secretBlob = row.active ?? row.pending;
  if (!secretBlob) return { ok: false, message: "Recarregue a página para gerar o QR Code." };

  if (!verifyTotp(decryptField(secretBlob, key), code)) {
    await audit(s.id, "staff_2fa_falhou", s.id);
    return { ok: false, message: "Código inválido. Confira o código no aplicativo e tente de novo." };
  }
  if (enrolling) {
    await sql()`
      update public.staff set totp_secret_encrypted = totp_pending_encrypted, totp_pending_encrypted = null
      where id = ${s.id}`;
  }
  await sql()`update public.staff_sessions set mfa_verified = true where id = ${s.session_id}`;
  await sql()`update public.staff set last_login_at = now() where id = ${s.id}`;
  await audit(s.id, enrolling ? "staff_2fa_cadastrado" : "staff_login_completo", s.id);
  return { ok: true };
}

// ------------------------------------------------------------------ primeiro acesso / equipe

export async function staffCount(): Promise<number> {
  const [{ n }] = await sql()<{ n: number }[]>`select count(*)::int as n from public.staff`;
  return n;
}

export async function createStaff(input: {
  name: string;
  email: string;
  password: string;
  role: StaffRole;
  createdBy: string | null;
}): Promise<LoginResult> {
  const problem = passwordProblem(input.password);
  if (problem) return { ok: false, message: problem };
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "E-mail inválido." };
  const [exists] = await sql()`select 1 from public.staff where email = ${email}`;
  if (exists) return { ok: false, message: "Já existe alguém da equipe com este e-mail." };
  const [created] = await sql()<{ id: string }[]>`
    insert into public.staff (name, email, password_hash, role)
    values (${input.name.trim()}, ${email}, ${await hashPassword(input.password)}, ${input.role})
    returning id`;
  await audit(input.createdBy, "staff_criado", created.id, { role: input.role });
  return { ok: true };
}

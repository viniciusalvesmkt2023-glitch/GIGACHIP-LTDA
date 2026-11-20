"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revealSensitive, type SensitiveField } from "@/lib/server/admin";
import { decideIdentity } from "@/lib/server/identity";
import { createStaff, login, logout, requireStaff, staffCount, verifySecondFactor, type StaffRole } from "@/lib/server/staff-auth";
import { env } from "@/lib/server/env";

export type FormState = { message?: string; ok?: boolean; value?: string; email?: string };

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};

export async function loginAction(_p: FormState, fd: FormData): Promise<FormState> {
  const r = await login(str(fd, "email"), str(fd, "password"));
  if (!r.ok) return { message: r.message, email: str(fd, "email") };
  redirect("/painel/2fa");
}

export async function totpAction(_p: FormState, fd: FormData): Promise<FormState> {
  const r = await verifySecondFactor(str(fd, "code"));
  if (!r.ok) return { message: r.message };
  redirect("/painel");
}

export async function logoutAction() {
  await logout();
  redirect("/painel/entrar");
}

/** Cria o 1º usuário (dono). Só funciona com o token de configuração e com a equipe vazia. */
export async function setupAction(_p: FormState, fd: FormData): Promise<FormState> {
  const token = env().ADMIN_SETUP_TOKEN;
  if (!token || str(fd, "setupToken") !== token) return { message: "Código de configuração inválido." };
  if ((await staffCount()) > 0) return { message: "O painel já foi configurado. Use a tela de entrar." };
  const r = await createStaff({ name: str(fd, "name"), email: str(fd, "email"), password: str(fd, "password"), role: "owner", createdBy: null });
  if (!r.ok) return { message: r.message };
  redirect("/painel/entrar?configurado=1");
}

const ROLES: StaffRole[] = ["admin", "ativador", "atendente", "financeiro", "owner"];

export async function createStaffAction(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await requireStaff(["owner"]);
  const role = str(fd, "role") as StaffRole;
  if (!ROLES.includes(role)) return { message: "Função inválida." };
  const r = await createStaff({ name: str(fd, "name"), email: str(fd, "email"), password: str(fd, "password"), role, createdBy: me.id });
  return r.ok ? { ok: true, message: "Pessoa adicionada. No 1º acesso ela vai cadastrar o 2FA." } : { message: r.message };
}

export async function decideIdentityAction(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await requireStaff(["owner", "admin", "ativador"]);
  const orderId = str(fd, "orderId");
  const approve = str(fd, "decision") === "aprovar";
  const reason = str(fd, "reason").trim();
  if (!approve && reason.length < 5) return { message: "Explique o motivo para o cliente (ex.: foto do documento ilegível)." };
  const r = await decideIdentity(orderId, me.id, approve ? { approve: true } : { approve: false, reason });
  return r.ok ? { ok: true, message: approve ? "Identidade aprovada." : "Cliente será orientado a enviar novas fotos." } : { message: r.message };
}

export async function revealAction(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await requireStaff(["owner", "admin", "ativador"]);
  const field = str(fd, "field") as SensitiveField;
  if (!["cpf", "imei", "eid", "iccid"].includes(field)) return { message: "Campo inválido." };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const value = await revealSensitive(me, str(fd, "orderId"), field, ip);
  return value ? { ok: true, value } : { message: "Não informado." };
}

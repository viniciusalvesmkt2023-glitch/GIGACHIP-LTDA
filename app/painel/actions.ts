"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { processQueuedContracts, retryContract, syncContractByDocument } from "@/lib/server/contracts";
import { changeCustomerEmail } from "@/lib/server/customer-admin";
import { sql } from "@/lib/server/db";
import { parseMoneyToCents, parseNumbersPaste } from "@/lib/domain/lines";
import { activateOrder, addAvailableNumbers, setLineCostCents } from "@/lib/server/lines";
import { d4sign } from "@/lib/integrations/d4sign/client";
import { redirect } from "next/navigation";
import { revealSensitive, type SensitiveField } from "@/lib/server/admin";
import { decideIdentity } from "@/lib/server/identity";
import { createStaff, login, logout, requireStaff, staffCount, verifySecondFactor, type StaffRole } from "@/lib/server/staff-auth";
import { env } from "@/lib/server/env";
import { blockCustomer, syncOverdue, unblockCustomer } from "@/lib/server/inadimplencia";

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
  refresh();
  return r.ok
    ? { ok: true, message: approve ? "Identidade aprovada." : "Cliente será orientado a enviar novas fotos." }
    : { message: r.message };
}

export async function revealAction(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await requireStaff(["owner", "admin", "ativador"]);
  const field = str(fd, "field") as SensitiveField;
  if (!["cpf", "imei", "eid", "iccid"].includes(field)) return { message: "Campo inválido." };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const value = await revealSensitive(me, str(fd, "orderId"), field, ip);
  return value ? { ok: true, value } : { message: "Não informado." };
}

export async function retryContractAction(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await requireStaff(["owner", "admin", "ativador"]);
  await retryContract(str(fd, "orderId"), me.id);
  const r = await processQueuedContracts(1);
  refresh();
  if (r.skipped) return { message: `Contrato na fila (${r.skipped}). Será enviado automaticamente.` };
  return r.sent ? { ok: true, message: "Contrato enviado ao cliente." } : { message: "Não foi possível enviar agora. Veja o erro abaixo; o sistema tenta de novo sozinho." };
}

export async function syncContractAction(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await requireStaff(["owner", "admin", "ativador"]);
  const [c] = await sql()<{ uuid: string | null }[]>`
    select provider_document_uuid as uuid from public.contracts where order_id = ${str(fd, "orderId")}`;
  if (!c?.uuid) return { message: "O contrato ainda não foi enviado." };
  try {
    const r = await syncContractByDocument(c.uuid, "staff", me.id);
    refresh();
    return { ok: true, message: `Status na D4Sign: ${r.ok ? r.status : r.reason}.` };
  } catch (e) {
    return { message: `Não foi possível consultar a D4Sign: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function listSafesAction(): Promise<FormState> {
  await requireStaff(["owner"]);
  try {
    const safes = await d4sign.listSafes();
    const list = safes.map((s) => `${s["name-safe"] ?? s.name_safe ?? "(sem nome)"}: ${s.uuid_safe}`).join("\n");
    return { ok: true, value: list || "Nenhum cofre encontrado." };
  } catch (e) {
    return { message: `Falha ao falar com a D4Sign: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function changeEmailAction(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await requireStaff(["owner", "admin", "ativador"]);
  const r = await changeCustomerEmail(me, str(fd, "orderId"), str(fd, "email"));
  refresh();
  return { ok: r.ok, message: r.messages.join(" ") };
}

export async function activateLineAction(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await requireStaff(["owner", "admin", "ativador"]);
  const sale = parseMoneyToCents(str(fd, "salePrice"));
  const cost = parseMoneyToCents(str(fd, "cost"));
  if (sale === null || cost === null) return { message: "Confira os valores de venda e do gestor." };
  if (!str(fd, "lineId")) return { message: "Escolha o número disponível." };
  const r = await activateOrder(me, str(fd, "orderId"), {
    lineId: str(fd, "lineId"),
    iccid: str(fd, "iccid"),
    smartDados: str(fd, "smartDados").trim(),
    salePriceCents: sale,
    costCents: cost,
  });
  refresh();
  return { ok: r.ok, message: r.message };
}

export async function addNumbersAction(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await requireStaff(["owner", "admin"]);
  const { rows, invalid } = parseNumbersPaste(str(fd, "numbers"), str(fd, "vivoLogin").trim() || null);
  if (!rows.length) return { message: "Nenhum número válido encontrado." + (invalid.length ? ` Linhas ignoradas: ${invalid.length}.` : "") };
  const r = await addAvailableNumbers(me, rows);
  refresh();
  const parts = [`${r.added} número(s) adicionado(s) como disponível.`];
  if (r.duplicated.length) parts.push(`${r.duplicated.length} já estava(m) cadastrado(s).`);
  if (invalid.length) parts.push(`${invalid.length} linha(s) ignorada(s) por número inválido.`);
  return { ok: true, message: parts.join(" ") };
}

export async function setCostAction(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await requireStaff(["owner"]);
  const cents = parseMoneyToCents(str(fd, "cost"));
  if (cents === null) return { message: "Valor inválido. Use, por exemplo, 30,00." };
  await setLineCostCents(me, cents);
  refresh();
  return { ok: true, message: "Valor do gestor atualizado. Vale para as próximas ativações." };
}

export async function blockCustomerAction(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await requireStaff(["owner", "admin", "ativador"]);
  const r = await blockCustomer(me, str(fd, "customerId"), str(fd, "lineId") || null);
  refresh();
  return r;
}

export async function unblockCustomerAction(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await requireStaff(["owner", "admin", "ativador"]);
  const r = await unblockCustomer(me, str(fd, "blockId"));
  refresh();
  return r;
}

export async function syncOverdueAction(): Promise<FormState> {
  await requireStaff(["owner", "admin", "ativador", "financeiro"]);
  try {
    const r = await syncOverdue({ force: true });
    refresh();
    return { ok: true, message: r.skipped ? "Atualizado." : `Atualizado: ${r.overdue} cobrança(s) vencida(s) no Asaas.` };
  } catch (e) {
    return { message: `Não foi possível falar com o Asaas: ${e instanceof Error ? e.message : String(e)}` };
  }
}

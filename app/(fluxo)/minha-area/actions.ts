"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asaas } from "@/lib/integrations/asaas/client";
import { ACCESS_COOKIE, currentOrderId } from "@/lib/server/customer-access";
import { faturaDoPedido } from "@/lib/server/customer-area";
import { requestLoginCode, switchOrder, verifyLoginCode } from "@/lib/server/customer-login";

/** "Sair" da Área do Cliente: apaga o acesso deste navegador (o link do e-mail continua valendo). */
export async function sairAction(): Promise<void> {
  (await cookies()).delete(ACCESS_COOKIE);
  redirect("/");
}

export type LoginState = { step: "email" | "codigo"; ok?: boolean; message?: string; email?: string };

export async function pedirCodigoAction(_p: LoginState, fd: FormData): Promise<LoginState> {
  const email = String(fd.get("email") ?? "");
  const r = await requestLoginCode(email);
  return r.ok ? { step: "codigo", ok: true, message: r.message, email } : { step: "email", message: r.message, email };
}

export async function conferirCodigoAction(prev: LoginState, fd: FormData): Promise<LoginState> {
  const r = await verifyLoginCode(String(fd.get("code") ?? ""));
  if (r.ok) redirect("/minha-area");
  return { step: "codigo", message: r.message, email: prev.email };
}

export async function trocarPedidoAction(fd: FormData): Promise<void> {
  const atual = await currentOrderId();
  const alvo = String(fd.get("pedido") ?? "");
  if (atual && /^[0-9a-f-]{36}$/i.test(alvo)) await switchOrder(atual, alvo);
  redirect("/minha-area");
}

export type PixState = { ok?: boolean; message?: string; payload?: string; image?: string; invoiceUrl?: string | null };

/** PIX de uma fatura do PRÓPRIO pedido (confere o dono antes de pedir ao Asaas). */
export async function pixDaFaturaAction(paymentId: string): Promise<PixState> {
  const orderId = await currentOrderId();
  if (!orderId) return { message: "Seu acesso expirou. Entre de novo." };
  const f = await faturaDoPedido(orderId, paymentId);
  if (!f) return { message: "Fatura não encontrada." };
  if (!["pending", "overdue"].includes(f.status)) return { message: "Esta fatura já foi paga." };
  try {
    const qr = await asaas.getPixQrCode(f.provider_payment_id);
    return { ok: true, payload: qr.payload, image: qr.encodedImage, invoiceUrl: f.invoice_url };
  } catch {
    return { message: "Não conseguimos gerar o PIX agora. Use o botão “Outras formas de pagar”.", invoiceUrl: f.invoice_url };
  }
}

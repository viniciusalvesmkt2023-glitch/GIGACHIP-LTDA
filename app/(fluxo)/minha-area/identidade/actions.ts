"use server";

import { IDENTITY_KINDS, type IdentityKind } from "@/lib/domain/image-check";
import { currentOrderId } from "@/lib/server/customer-access";
import { submitIdentityFiles } from "@/lib/server/identity";

export type IdentityUploadState = { ok?: boolean; message?: string; field?: IdentityKind };

/** Ação pública: só age sobre o pedido do cookie de acesso deste navegador. */
export async function uploadIdentity(formData: FormData): Promise<IdentityUploadState> {
  const orderId = await currentOrderId();
  if (!orderId) return { message: "Sua sessão expirou. Abra novamente o link enviado ao seu e-mail." };
  const files = Object.fromEntries(
    IDENTITY_KINDS.map((k) => {
      const v = formData.get(k);
      return [k, v instanceof File ? v : null];
    }),
  ) as Record<IdentityKind, File | null>;
  const r = await submitIdentityFiles(orderId, files);
  return r.ok ? { ok: true } : { message: r.message, field: r.field };
}

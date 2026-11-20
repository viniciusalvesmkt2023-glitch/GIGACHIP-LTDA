import "server-only";
import { createHash } from "node:crypto";
import {
  IDENTITY_KINDS,
  MAX_IDENTITY_ATTEMPTS,
  MAX_IDENTITY_FILE_BYTES,
  sniffImage,
  type IdentityKind,
} from "@/lib/domain/image-check";
import { decryptBytes, encryptBytes } from "./crypto";
import { queueContract } from "./contracts";
import { sql, withActor } from "./db";
import { env } from "./env";

/**
 * Validação de identidade no modo "manual assistido" (D3, D17):
 * o cliente envia documento + selfie pela área segura; a equipe aprova no painel.
 * As imagens ficam CIFRADAS no banco e têm data para serem apagadas.
 */

/** Prazo provisório de guarda das imagens (definir com o advogado — doc 00). */
const RETENTION_DAYS = 90;

export type UploadResult =
  | { ok: true }
  | { ok: false; field?: IdentityKind; message: string };

export async function submitIdentityFiles(orderId: string, files: Record<IdentityKind, File | null>): Promise<UploadResult> {
  const prepared: { kind: IdentityKind; mime: string; bytes: Buffer }[] = [];
  for (const kind of IDENTITY_KINDS) {
    const file = files[kind];
    if (!file || file.size === 0) return { ok: false, field: kind, message: "Envie esta foto." };
    if (file.size > MAX_IDENTITY_FILE_BYTES) return { ok: false, field: kind, message: "Foto muito grande. Tente de novo." };
    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = sniffImage(bytes);
    if (!mime) return { ok: false, field: kind, message: "Envie uma foto (JPG, PNG ou WEBP)." };
    prepared.push({ kind, mime, bytes });
  }

  const key = env().FIELD_ENCRYPTION_KEY;
  return withActor({ type: "customer", reason: "documentos de identidade enviados" }, async (tx) => {
    const [order] = await tx<{ status: string; identity_status: string }[]>`
      select status, identity_status from public.orders where id = ${orderId} for update`;
    if (!order || order.status !== "em_andamento" || !["not_started", "pending_documents", "retry_required"].includes(order.identity_status)) {
      return { ok: false, message: "Não é possível enviar documentos agora. Atualize a página." } as const;
    }

    const [previous] = await tx<{ attempts: number }[]>`
      select attempts from public.identity_checks where order_id = ${orderId} for update`;
    if (previous && previous.attempts >= MAX_IDENTITY_ATTEMPTS) {
      return { ok: false, message: "Limite de tentativas atingido. Fale com a gente pelo WhatsApp." } as const;
    }
    const [check] = await tx<{ id: string }[]>`
      insert into public.identity_checks (order_id, provider, status, attempts)
      values (${orderId}, 'manual', 'in_review', 1)
      on conflict (order_id) do update
        set status = 'in_review', attempts = public.identity_checks.attempts + 1,
            rejection_reason = null, reviewed_by = null, decided_at = null
      returning id`;

    // Tentativa nova substitui as imagens anteriores (que são apagadas)
    await tx`delete from public.identity_files where identity_check_id = ${check.id}`;
    for (const f of prepared) {
      const [row] = await tx<{ id: string }[]>`
        insert into public.identity_files (identity_check_id, kind, sha256, mime_type, size_bytes, delete_after)
        values (${check.id}, ${f.kind}, ${createHash("sha256").update(f.bytes).digest("hex")}, ${f.mime},
                ${f.bytes.length}, now() + make_interval(days => ${RETENTION_DAYS}))
        returning id`;
      await tx`insert into public.identity_file_blobs (file_id, content_encrypted) values (${row.id}, ${encryptBytes(f.bytes, key)})`;
    }
    await tx`update public.orders set identity_status = 'in_review' where id = ${orderId}`;
    return { ok: true } as const;
  });
}

export type IdentityReview = {
  checkId: string;
  status: string;
  attempts: number;
  rejectionReason: string | null;
  files: { id: string; kind: IdentityKind; createdAt: Date }[];
};

export async function getIdentityReview(orderId: string): Promise<IdentityReview | null> {
  const [check] = await sql()<{ id: string; status: string; attempts: number; rejection_reason: string | null }[]>`
    select id, status, attempts, rejection_reason from public.identity_checks where order_id = ${orderId}`;
  if (!check) return null;
  const files = await sql()<{ id: string; kind: IdentityKind; created_at: Date }[]>`
    select id, kind, created_at from public.identity_files
    where identity_check_id = ${check.id} and deleted_at is null order by kind`;
  return {
    checkId: check.id,
    status: check.status,
    attempts: check.attempts,
    rejectionReason: check.rejection_reason,
    files: files.map((f) => ({ id: f.id, kind: f.kind, createdAt: f.created_at })),
  };
}

/** Lê uma imagem (já decifrada) para a equipe ver — sempre registrado na auditoria. */
export async function readIdentityFile(fileId: string, staffId: string, ip: string | null) {
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) return null;
  const [row] = await sql()<{ mime_type: string; content: Uint8Array; order_id: string }[]>`
    select f.mime_type, b.content_encrypted as content, c.order_id
    from public.identity_files f
    join public.identity_file_blobs b on b.file_id = f.id
    join public.identity_checks c on c.id = f.identity_check_id
    where f.id = ${fileId} and f.deleted_at is null`;
  if (!row) return null;
  await sql()`
    insert into public.audit_log (actor_id, action, entity, entity_id, metadata, ip)
    values (${staffId}, 'ver_documento_identidade', 'orders', ${row.order_id}, ${sql().json({ fileId })}, ${ip})`;
  return { mime: row.mime_type, bytes: decryptBytes(row.content, env().FIELD_ENCRYPTION_KEY) };
}

export async function decideIdentity(
  orderId: string,
  staffId: string,
  decision: { approve: true } | { approve: false; reason: string },
): Promise<{ ok: boolean; message?: string }> {
  return withActor({ type: "staff", id: staffId, reason: decision.approve ? "identidade aprovada" : `identidade recusada: ${decision.reason}` }, async (tx) => {
    const [check] = await tx<{ id: string; status: string; attempts: number }[]>`
      select id, status, attempts from public.identity_checks where order_id = ${orderId} for update`;
    if (!check || check.status !== "in_review") return { ok: false, message: "Esta identidade não está aguardando análise." };

    if (decision.approve) {
      await tx`update public.identity_checks set status = 'approved', reviewed_by = ${staffId}, decided_at = now() where id = ${check.id}`;
      await tx`update public.orders set identity_status = 'approved' where id = ${orderId}`;
      // Identidade aprovada → contrato entra na fila de envio pela D4Sign (doc 05, regra 3)
      await queueContract(tx, orderId);
      return { ok: true };
    }

    const final = check.attempts >= MAX_IDENTITY_ATTEMPTS;
    const status = final ? "rejected" : "retry_required";
    await tx`
      update public.identity_checks
      set status = ${status}, rejection_reason = ${decision.reason}, reviewed_by = ${staffId}, decided_at = now()
      where id = ${check.id}`;
    if (final) {
      await tx`
        update public.orders set identity_status = 'rejected', status = 'pendencia', problem_reason = 'identidade_recusada'
        where id = ${orderId}`;
    } else {
      await tx`update public.orders set identity_status = 'retry_required' where id = ${orderId}`;
    }
    return { ok: true };
  });
}

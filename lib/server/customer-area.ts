import "server-only";
import type { DeviceInput } from "@/lib/domain/device-input";
import { createHash } from "node:crypto";
import { sniffImage } from "@/lib/domain/image-check";
import { queueContract } from "./contracts";
import { encryptBytes, encryptField } from "./crypto";
import { sql, withActor } from "./db";
import { env } from "./env";
import { shortOrderNumber } from "@/lib/domain/money";

/** O que o cliente vê na "Minha área" (sem CPF, sem dados do aparelho completos). */
export type AreaView = {
  orderId: string;
  code: string;
  planName: string;
  simType: "esim" | "physical";
  status: string;
  paymentStatus: string;
  identityStatus: string;
  contractStatus: string;
  deviceStatus: string;
  imeiLast4: string | null;
  firstName: string;
  fullName: string;
  /** E-mail com o meio escondido (ex.: "ma•••@gmail.com"), para a tela mostrar para onde foi o contrato. */
  emailMasked: string;
};

function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  return `${user.slice(0, 2)}•••@${domain}`;
}

export async function getAreaView(orderId: string): Promise<AreaView | null> {
  const [r] = await sql()<
    {
      id: string; code: string; plan_name: string; sim_type: AreaView["simType"]; status: string;
      payment_status: string; identity_status: string; contract_status: string; device_status: string;
      imei_last4: string | null; full_name: string; email: string;
    }[]
  >`
    select o.id, o.code, o.plan_snapshot->>'name' as plan_name, o.sim_type, o.status, o.payment_status,
           o.identity_status, o.contract_status, o.device_status, d.imei_last4, c.full_name, c.email::text as email
    from public.orders o
    join public.customers c on c.id = o.customer_id
    left join public.device_info d on d.order_id = o.id
    where o.id = ${orderId}`;
  if (!r) return null;
  return {
    orderId: r.id,
    code: shortOrderNumber(r.code),
    planName: r.plan_name,
    simType: r.sim_type,
    status: r.status,
    paymentStatus: r.payment_status,
    identityStatus: r.identity_status,
    contractStatus: r.contract_status,
    deviceStatus: r.device_status,
    imeiLast4: r.imei_last4,
    firstName: r.full_name.split(/\s+/)[0] ?? "",
    fullName: r.full_name,
    emailMasked: maskEmail(r.email),
  };
}

/** Status em que o cliente ainda pode informar/corrigir os dados do aparelho. */
const DEVICE_EDITABLE = ["em_andamento", "pendencia"];

export type SaveDeviceResult = { ok: true } | { ok: false; code: "pedido_nao_editavel" | "print_invalido" };

/** Prazo provisório de guarda do print do *#06# (definir com o advogado). */
const SCREENSHOT_RETENTION_DAYS = 90;
const MAX_SCREENSHOT_BYTES = 1_500_000;

export async function saveDevice(
  orderId: string,
  input: DeviceInput,
  extra: { screenshot?: File | null; fromOcr?: boolean; imageKind?: "print_esim" | "foto_embalagem" } = {},
): Promise<SaveDeviceResult> {
  const key = env().FIELD_ENCRYPTION_KEY;
  let shot: { bytes: Buffer; mime: string } | null = null;
  if (extra.screenshot && extra.screenshot.size > 0) {
    if (extra.screenshot.size > MAX_SCREENSHOT_BYTES) return { ok: false, code: "print_invalido" };
    const bytes = Buffer.from(await extra.screenshot.arrayBuffer());
    const mime = sniffImage(bytes);
    if (!mime) return { ok: false, code: "print_invalido" };
    shot = { bytes, mime };
  }
  return withActor({ type: "customer", reason: "dados do aparelho informados" }, async (tx) => {
    const [order] = await tx<{ status: string; sim_type: string }[]>`
      select status, sim_type from public.orders where id = ${orderId} for update`;
    if (!order || !DEVICE_EDITABLE.includes(order.status)) return { ok: false, code: "pedido_nao_editavel" } as const;

    const values = {
      imei: input.imei ? encryptField(input.imei, key) : null,
      eid: input.eid ? encryptField(input.eid, key) : null,
      iccid: input.iccid ? encryptField(input.iccid, key) : null,
      last4: input.imei ? input.imei.slice(-4) : null,
      warnings: input.warnings,
    };
    await tx`
      insert into public.device_info
        (order_id, imei_encrypted, imei_last4, eid_encrypted, iccid_encrypted, checksum_warnings, source, confirmed_at, image_kind)
      values (${orderId}, ${values.imei}, ${values.last4}, ${values.eid}, ${values.iccid}, ${values.warnings},
              ${extra.fromOcr ? "ocr_confirmed" : "typed"}, now(), ${extra.imageKind ?? null})
      on conflict (order_id) do update set
        imei_encrypted = excluded.imei_encrypted, imei_last4 = excluded.imei_last4,
        eid_encrypted = excluded.eid_encrypted, iccid_encrypted = excluded.iccid_encrypted,
        checksum_warnings = excluded.checksum_warnings, source = excluded.source, confirmed_at = now(),
        image_kind = coalesce(excluded.image_kind, public.device_info.image_kind)`;
    if (shot) {
      await tx`
        insert into public.device_screenshots (order_id, mime_type, size_bytes, sha256, content_encrypted, delete_after)
        values (${orderId}, ${shot.mime}, ${shot.bytes.length}, ${createHash("sha256").update(shot.bytes).digest("hex")},
                ${encryptBytes(shot.bytes, key)}, now() + make_interval(days => ${SCREENSHOT_RETENTION_DAYS}))
        on conflict (order_id) do update set
          mime_type = excluded.mime_type, size_bytes = excluded.size_bytes, sha256 = excluded.sha256,
          content_encrypted = excluded.content_encrypted, delete_after = excluded.delete_after, created_at = now()`;
    }
    await tx`update public.orders set device_status = 'confirmed' where id = ${orderId}`;
    // D28: ID do celular recebido → contrato (com documento + selfie) vai para o e-mail do cliente
    const [paid] = await tx`
      select 1 from public.orders where id = ${orderId} and payment_status in ('confirmed', 'received')`;
    if (paid) await queueContract(tx, orderId);
    return { ok: true } as const;
  });
}

/**
 * Dados do aparelho do PRÓPRIO cliente (link/cookie dele), para montar a mensagem do WhatsApp
 * que ele mesmo envia à equipe pedindo a ativação (D28). Não inclui CPF nem documentos.
 */
export async function deviceForWhatsapp(orderId: string) {
  const [d] = await sql()<{ imei: Uint8Array | null; eid: Uint8Array | null; iccid: Uint8Array | null }[]>`
    select imei_encrypted as imei, eid_encrypted as eid, iccid_encrypted as iccid
    from public.device_info where order_id = ${orderId}`;
  if (!d) return null;
  const key = env().FIELD_ENCRYPTION_KEY;
  const { decryptField } = await import("./crypto");
  return {
    imei: d.imei ? decryptField(d.imei, key) : null,
    eid: d.eid ? decryptField(d.eid, key) : null,
    iccid: d.iccid ? decryptField(d.iccid, key) : null,
  };
}

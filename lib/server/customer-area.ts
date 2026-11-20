import "server-only";
import type { DeviceInput } from "@/lib/domain/device-input";
import { encryptField } from "./crypto";
import { sql, withActor } from "./db";
import { env } from "./env";

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
};

export async function getAreaView(orderId: string): Promise<AreaView | null> {
  const [r] = await sql()<
    {
      id: string; code: string; plan_name: string; sim_type: AreaView["simType"]; status: string;
      payment_status: string; identity_status: string; contract_status: string; device_status: string;
      imei_last4: string | null; full_name: string;
    }[]
  >`
    select o.id, o.code, o.plan_snapshot->>'name' as plan_name, o.sim_type, o.status, o.payment_status,
           o.identity_status, o.contract_status, o.device_status, d.imei_last4, c.full_name
    from public.orders o
    join public.customers c on c.id = o.customer_id
    left join public.device_info d on d.order_id = o.id
    where o.id = ${orderId}`;
  if (!r) return null;
  return {
    orderId: r.id,
    code: r.code,
    planName: r.plan_name,
    simType: r.sim_type,
    status: r.status,
    paymentStatus: r.payment_status,
    identityStatus: r.identity_status,
    contractStatus: r.contract_status,
    deviceStatus: r.device_status,
    imeiLast4: r.imei_last4,
    firstName: r.full_name.split(/\s+/)[0] ?? "",
  };
}

/** Status em que o cliente ainda pode informar/corrigir os dados do aparelho. */
const DEVICE_EDITABLE = ["em_andamento", "pendencia"];

export type SaveDeviceResult = { ok: true } | { ok: false; code: "pedido_nao_editavel" };

export async function saveDevice(orderId: string, input: DeviceInput): Promise<SaveDeviceResult> {
  const key = env().FIELD_ENCRYPTION_KEY;
  return withActor({ type: "customer", reason: "dados do aparelho informados" }, async (tx) => {
    const [order] = await tx<{ status: string; sim_type: string }[]>`
      select status, sim_type from public.orders where id = ${orderId} for update`;
    if (!order || !DEVICE_EDITABLE.includes(order.status)) return { ok: false, code: "pedido_nao_editavel" } as const;

    const values = {
      imei: encryptField(input.imei, key),
      eid: input.eid ? encryptField(input.eid, key) : null,
      iccid: input.iccid ? encryptField(input.iccid, key) : null,
      last4: input.imei.slice(-4),
      warnings: input.warnings,
    };
    await tx`
      insert into public.device_info
        (order_id, imei_encrypted, imei_last4, eid_encrypted, iccid_encrypted, checksum_warnings, source, confirmed_at)
      values (${orderId}, ${values.imei}, ${values.last4}, ${values.eid}, ${values.iccid}, ${values.warnings}, 'typed', now())
      on conflict (order_id) do update set
        imei_encrypted = excluded.imei_encrypted, imei_last4 = excluded.imei_last4,
        eid_encrypted = excluded.eid_encrypted, iccid_encrypted = excluded.iccid_encrypted,
        checksum_warnings = excluded.checksum_warnings, source = excluded.source, confirmed_at = now()`;
    await tx`update public.orders set device_status = 'confirmed' where id = ${orderId}`;
    return { ok: true } as const;
  });
}

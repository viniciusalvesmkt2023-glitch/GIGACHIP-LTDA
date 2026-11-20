import { headers } from "next/headers";
import { decryptBytes } from "@/lib/server/crypto";
import { sql } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { requireStaff } from "@/lib/server/staff-auth";

/** Print do *#06# enviado pelo cliente. [id] = id do pedido. Decifrado na hora e auditado. */
export async function GET(_req: Request, ctx: RouteContext<"/painel/prints/[id]">) {
  const me = await requireStaff(["owner", "admin", "ativador"]);
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("não encontrado", { status: 404 });
  const [row] = await sql()<{ mime_type: string; content: Uint8Array }[]>`
    select mime_type, content_encrypted as content from public.device_screenshots where order_id = ${id}`;
  if (!row) return new Response("não encontrado", { status: 404 });
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  await sql()`
    insert into public.audit_log (actor_id, action, entity, entity_id, metadata, ip)
    values (${me.id}, 'ver_print_aparelho', 'orders', ${id}, '{}'::jsonb, ${ip})`;
  return new Response(new Uint8Array(decryptBytes(row.content, env().FIELD_ENCRYPTION_KEY)), {
    headers: { "Content-Type": row.mime_type, "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" },
  });
}

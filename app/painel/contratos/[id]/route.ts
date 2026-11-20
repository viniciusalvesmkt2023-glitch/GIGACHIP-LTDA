import { headers } from "next/headers";
import { readSignedContract } from "@/lib/server/contracts";
import { requireStaff } from "@/lib/server/staff-auth";

/** PDF do contrato ASSINADO (com relatório da D4Sign). [id] = id do pedido. Auditado. */
export async function GET(_req: Request, ctx: RouteContext<"/painel/contratos/[id]">) {
  const me = await requireStaff(["owner", "admin", "ativador"]);
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("não encontrado", { status: 404 });
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const file = await readSignedContract(id, me.id, ip);
  if (!file) return new Response("contrato assinado ainda não disponível", { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Contrato ${file.code} (assinado).pdf"`,
      "Cache-Control": "no-store, private",
    },
  });
}

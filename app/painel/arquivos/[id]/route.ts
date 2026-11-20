import { headers } from "next/headers";
import { readIdentityFile } from "@/lib/server/identity";
import { requireStaff } from "@/lib/server/staff-auth";

/** Imagem de documento/selfie para a equipe — decifrada na hora, nunca em cache, sempre auditada. */
export async function GET(_req: Request, ctx: RouteContext<"/painel/arquivos/[id]">) {
  const me = await requireStaff(["owner", "admin", "ativador"]);
  const { id } = await ctx.params;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const file = await readIdentityFile(id, me.id, ip);
  if (!file) return new Response("não encontrado", { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.mime,
      "Cache-Control": "no-store, private",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

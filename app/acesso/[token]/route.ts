import { redirect } from "next/navigation";
import { orderIdFromToken, setAccessCookie } from "@/lib/server/customer-access";

/** Link do e-mail / da D4Sign: valida o token, grava o cookie e abre o Formulário de ativação. */
export async function GET(_req: Request, ctx: RouteContext<"/acesso/[token]">) {
  const { token } = await ctx.params;
  const orderId = await orderIdFromToken(token);
  if (!orderId) redirect("/ativacao?link=invalido");
  await setAccessCookie(token);
  redirect("/ativacao");
}

import { redirect } from "next/navigation";
import { orderIdFromToken, setAccessCookie } from "@/lib/server/customer-access";

/** Link do e-mail: valida o token, grava o cookie e leva para a Minha área. */
export async function GET(_req: Request, ctx: RouteContext<"/acesso/[token]">) {
  const { token } = await ctx.params;
  const orderId = await orderIdFromToken(token);
  if (!orderId) redirect("/minha-area?link=invalido");
  await setAccessCookie(token);
  redirect("/minha-area");
}

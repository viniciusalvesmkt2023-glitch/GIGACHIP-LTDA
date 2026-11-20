import { getPaymentView } from "@/lib/server/payments";

/** Status do pedido para a página de pagamento (sem dados pessoais). */
export async function GET(_request: Request, ctx: RouteContext<"/api/pedidos/[id]/status">) {
  const { id } = await ctx.params;
  const view = await getPaymentView(id);
  if (!view) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(
    { status: view.status, paymentStatus: view.paymentStatus },
    { headers: { "Cache-Control": "no-store" } },
  );
}

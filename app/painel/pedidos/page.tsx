import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { listOrders, STATUS_LABEL } from "@/lib/server/admin";
import { requireStaff } from "@/lib/server/staff-auth";
import { Card, PanelShell } from "../shell";

export const metadata: Metadata = { title: "Pedidos" };

const CHECK: Record<string, string> = { approved: "✓", signed: "✓", confirmed: "✓", in_review: "⏳", sent: "⏳", retry_required: "↻", rejected: "✗", error: "✗" };

async function Content({ searchParams }: { searchParams: PageProps<"/painel/pedidos">["searchParams"] }) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const orders = await listOrders(staff, { status, q, identityReview: sp.identidade === "1" });
  return (
    <PanelShell staff={staff}>
      <h1 className="text-2xl font-bold">Pedidos</h1>
      <form className="mt-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Código, nome ou e-mail" className="min-w-60 flex-1 rounded-xl border border-border bg-white px-4 py-2" />
        <select name="status" defaultValue={status ?? ""} className="rounded-xl border border-border bg-white px-3 py-2">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white">Filtrar</button>
      </form>
      <Card className="mt-4 overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-surface text-muted">
            <tr>
              <th className="p-3">Pedido</th><th className="p-3">Cliente</th><th className="p-3">Plano</th>
              <th className="p-3">Status</th><th className="p-3" title="Identidade · Contrato · Aparelho">Id · Ct · Ap</th><th className="p-3">Criado</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-border hover:bg-surface">
                <td className="p-3 font-mono"><Link href={`/painel/pedidos/${o.id}`} className="text-brand underline">{o.code}</Link></td>
                <td className="p-3">{o.customerName}</td>
                <td className="p-3">{o.planName} · {o.simType === "esim" ? "eSIM" : "Chip"}</td>
                <td className="p-3">{STATUS_LABEL[o.status] ?? o.status}</td>
                <td className="p-3 font-mono">{CHECK[o.identityStatus] ?? "·"} {CHECK[o.contractStatus] ?? "·"} {CHECK[o.deviceStatus] ?? "·"}</td>
                <td className="p-3 text-muted">{o.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted">Nenhum pedido encontrado.</td></tr>}
          </tbody>
        </table>
      </Card>
    </PanelShell>
  );
}

export default function PedidosPage({ searchParams }: PageProps<"/painel/pedidos">) {
  return <Suspense fallback={<div className="p-8">Carregando…</div>}><Content searchParams={searchParams} /></Suspense>;
}

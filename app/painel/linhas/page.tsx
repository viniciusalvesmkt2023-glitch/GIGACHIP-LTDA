import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatMsisdn } from "@/lib/domain/lines";
import { formatBRL } from "@/lib/domain/money";
import { lineCounts, listLines } from "@/lib/server/lines";
import { requireStaff } from "@/lib/server/staff-auth";
import { addNumbersAction } from "../actions";
import { AddNumbersForm } from "../forms";
import { Card, PanelShell } from "../shell";

export const metadata: Metadata = { title: "Linhas" };

const STATUS: Record<string, string> = {
  disponivel: "Disponível", ativa: "Ativa", suspensao_pendente: "Bloquear na Vivo", suspensa: "Bloqueada",
  reativacao_pendente: "Desbloquear na Vivo", cancelamento_pendente: "Cancelar na Vivo", cancelada: "Cancelada",
};
const brDate = (d: Date | string | null) => {
  if (!d) return "";
  const iso = typeof d === "string" ? d : d.toISOString();
  const [y, m, day] = iso.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
};

async function Content({ searchParams }: { searchParams: PageProps<"/painel/linhas">["searchParams"] }) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const [rows, counts] = await Promise.all([listLines({ status, q }), lineCounts()]);
  const canEdit = ["owner", "admin"].includes(staff.role);

  return (
    <PanelShell staff={staff}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Linhas</h1>
        {["owner", "admin", "financeiro"].includes(staff.role) && (
          <a href="/painel/linhas/exportar" className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold">⬇ Baixar planilha (Excel)</a>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">
        Disponíveis: <strong>{counts.disponivel ?? 0}</strong> · Ativas: <strong>{counts.ativa ?? 0}</strong> · Bloqueadas:{" "}
        <strong>{counts.suspensa ?? 0}</strong>
      </p>

      <form className="mt-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Cliente, número, ICCID ou pedido" className="min-w-60 flex-1 rounded-xl border border-border bg-white px-4 py-2" />
        <select name="status" defaultValue={status ?? ""} className="rounded-xl border border-border bg-white px-3 py-2">
          <option value="">Todas</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white">Filtrar</button>
      </form>

      <Card className="mt-4 overflow-x-auto p-0">
        <table className="w-full min-w-[1100px] text-left text-xs">
          <thead className="bg-[#3b0a5c] text-white">
            <tr>
              {["Cliente", "Login Vivo", "Número", "ICCID atual", "Smart-Dados", "Plano PJ", "Ativação", "Venda final", "Valor", "Vencimento", "Pagamento", "Situação"].map((h) => (
                <th key={h} className="p-2 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-surface">
                <td className="p-2 font-medium">
                  {r.status === "disponivel" ? <span className="text-brand">Disponível</span>
                    : r.orderId ? <Link href={`/painel/pedidos/${r.orderId}`} className="underline">{r.customer}</Link> : r.customer}
                </td>
                <td className="p-2">{r.vivoLogin}</td>
                <td className="p-2 font-mono">{formatMsisdn(r.msisdn)}</td>
                <td className="p-2 font-mono">{r.iccid}</td>
                <td className="p-2">{r.smartDados}</td>
                <td className="p-2">{r.planoPj}</td>
                <td className="p-2">{brDate(r.activatedAt)}</td>
                <td className="p-2">{r.salePriceCents !== null ? formatBRL(r.salePriceCents) : ""}</td>
                <td className="p-2">{r.costCents !== null ? formatBRL(r.costCents) : ""}</td>
                <td className="p-2">{brDate(r.dueDate)}</td>
                <td className="p-2">{r.paymentMethod}</td>
                <td className="p-2">{STATUS[r.status] ?? r.status}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={12} className="p-6 text-center text-muted">Nenhuma linha. Cadastre os números disponíveis abaixo.</td></tr>}
          </tbody>
        </table>
      </Card>

      {canEdit && (
        <Card title="Adicionar números disponíveis ao estoque" className="mt-4">
          <AddNumbersForm action={addNumbersAction} />
        </Card>
      )}
    </PanelShell>
  );
}

export default function LinhasPage({ searchParams }: PageProps<"/painel/linhas">) {
  return <Suspense fallback={<div className="p-8">Carregando…</div>}><Content searchParams={searchParams} /></Suspense>;
}

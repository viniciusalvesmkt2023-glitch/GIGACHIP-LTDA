import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { formatMsisdn } from "@/lib/domain/lines";
import { getLine } from "@/lib/server/lines";
import { getSheetConfig, sheetEnabled } from "@/lib/server/planilha";
import { requireStaff } from "@/lib/server/staff-auth";
import { updateLineAction } from "../../actions";
import { LineEditForm } from "../../forms";
import { Card, PanelShell } from "../../shell";

export const metadata: Metadata = { title: "Editar linha" };

const money = (c: number | null) => (c === null ? "" : (c / 100).toFixed(2).replace(".", ","));
const STATUS: Record<string, string> = {
  disponivel: "Disponível", ativa: "Ativa", suspensao_pendente: "Bloquear na Vivo", suspensa: "Bloqueada",
  reativacao_pendente: "Desbloquear na Vivo", cancelamento_pendente: "Cancelar na Vivo", cancelada: "Cancelada",
};

async function Content({ params }: { params: PageProps<"/painel/linhas/[id]">["params"] }) {
  const staff = await requireStaff(["owner", "admin", "ativador"]);
  const { id } = await params;
  const line = await getLine(id);
  if (!line) notFound();
  const [sheetOn, cfg] = await Promise.all([sheetEnabled(), getSheetConfig()]);
  const legacy = !line.orderId;

  return (
    <PanelShell staff={staff}>
      {line.sheetPending && !line.sheetError && <AutoRefresh seconds={3} />}
      <Link href="/painel/linhas" className="text-sm text-brand">← Linhas</Link>
      <h1 className="mt-2 font-mono text-2xl font-bold">{formatMsisdn(line.msisdn)}</h1>
      <p className="mt-1 text-sm text-muted">
        {STATUS[line.status] ?? line.status}
        {line.orderCode && <> · pedido <Link href={`/painel/pedidos/${line.orderId}`} className="underline">{line.orderCode}</Link></>}
        {line.sheetRow && cfg && (
          <> · <a href={`https://docs.google.com/spreadsheets/d/${cfg.spreadsheetId}/edit#range=A${line.sheetRow}`} target="_blank" rel="noopener noreferrer" className="underline">linha {line.sheetRow} da planilha ↗</a></>
        )}
      </p>

      {sheetOn && line.sheetPending && !line.sheetError && <p className="mt-3 text-sm text-muted">Planilha: escrevendo a correção…</p>}
      {sheetOn && line.sheetError && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-danger">Planilha: {line.sheetError}</p>}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card title="Corrigir dados">
          {line.status === "disponivel" ? (
            <p className="text-sm text-muted">Número disponível — para vender, use “Ativar linha” no pedido.</p>
          ) : (
            <LineEditForm
              action={updateLineAction}
              legacy={legacy}
              line={{
                id: line.id, customer: line.customer ?? "", iccid: line.iccid ?? "", smartDados: line.smartDados ?? "",
                activatedOn: line.activatedOn ?? "", salePrice: money(line.salePriceCents), cost: money(line.costCents),
                dueDate: line.dueDate ?? "", notes: line.notes ?? "",
              }}
            />
          )}
        </Card>
        <Card title="Do gestor (só na planilha)">
          <dl className="space-y-1 text-sm">
            <div><dt className="inline text-muted">Login Vivo: </dt><dd className="inline">{line.vivoLogin ?? "—"}</dd></div>
            <div><dt className="inline text-muted">Plano PJ: </dt><dd className="inline">{line.planoPj ?? "—"}</dd></div>
            <div><dt className="inline text-muted">Forma de pagamento: </dt><dd className="inline">{line.paymentMethod ?? "—"}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-muted">
            Essas colunas são do gestor: mude direto na planilha e clique em “Ler planilha agora”.
            {!legacy && " Nome e vencimento deste cliente vêm do cadastro e da assinatura do site."}
          </p>
          {sheetOn && (
            <p className="mt-3 text-xs text-muted">Ao salvar, a correção também é escrita na planilha do gestor (no mesmo estilo das outras linhas).</p>
          )}
        </Card>
      </div>
    </PanelShell>
  );
}

export default function EditarLinhaPage({ params }: PageProps<"/painel/linhas/[id]">) {
  return <Suspense fallback={<div className="p-8">Carregando…</div>}><Content params={params} /></Suspense>;
}

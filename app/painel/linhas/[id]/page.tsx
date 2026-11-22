import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatMsisdn } from "@/lib/domain/lines";
import { getLine } from "@/lib/server/lines";
import { getSheetConfig, sheetEnabled } from "@/lib/server/planilha";
import { requireStaff } from "@/lib/server/staff-auth";
import { updateLineAction } from "../../actions";
import { LineEditForm } from "../../forms";
import { SheetStatus } from "../../sheet-status";
import { Card, PanelShell } from "../../shell";
import { LineBadge } from "../../status-badge";

export const metadata: Metadata = { title: "Editar linha" };

const money = (c: number | null) => (c === null ? "" : (c / 100).toFixed(2).replace(".", ","));

async function Content({ params }: { params: PageProps<"/painel/linhas/[id]">["params"] }) {
  const staff = await requireStaff(["owner", "admin", "ativador"]);
  const { id } = await params;
  const line = await getLine(id);
  if (!line) notFound();
  const [sheetOn, cfg] = await Promise.all([sheetEnabled(), getSheetConfig()]);
  const legacy = !line.orderId;

  return (
    <PanelShell staff={staff}>
      <Link href="/painel/linhas" className="od-back">← Linhas</Link>
      <div className="od-head">
        <h1>{formatMsisdn(line.msisdn)}</h1>
        <LineBadge status={line.status} />
        <span className="od-sub">
          {line.customer ?? "Sem cliente"}
          {line.orderCode && <> · <Link href={`/painel/pedidos/${line.orderId}`} className="underline">pedido {line.orderCode}</Link></>}
          {line.sheetRow && cfg && (
            <> · <a href={`https://docs.google.com/spreadsheets/d/${cfg.spreadsheetId}/edit#range=A${line.sheetRow}`} target="_blank" rel="noopener noreferrer" className="underline">linha {line.sheetRow} da planilha ↗</a></>
          )}
        </span>
      </div>

      {sheetOn && (line.sheetPending || line.sheetError) && (
        <div className="mt-3 text-sm">
          <SheetStatus
            now={new Date()}
            canRetry
            writing="escrevendo a correção…"
            line={{ id: line.id, pending: line.sheetPending, error: line.sheetError, syncedAt: line.sheetSyncedAt, updatedAt: line.updatedAt }}
          />
        </div>
      )}

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-[1fr_320px]">
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

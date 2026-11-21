import type { Metadata } from "next";
import { Suspense } from "react";
import { getLineCostCents } from "@/lib/server/lines";
import { getSheetConfig } from "@/lib/server/planilha";
import { requireStaff } from "@/lib/server/staff-auth";
import { setCostAction, setSheetConfigAction } from "../actions";
import { CostForm, SheetConfigForm } from "../forms";
import { Card, PanelShell } from "../shell";

export const metadata: Metadata = { title: "Configurações" };

async function Content() {
  const staff = await requireStaff(["owner"]);
  const [cost, sheet] = await Promise.all([getLineCostCents(), getSheetConfig()]);
  return (
    <PanelShell staff={staff}>
      <h1 className="text-2xl font-bold">Configurações</h1>
      <Card title="Valor do gestor" className="mt-4">
        <p className="mb-3 text-sm text-muted">
          Valor pago ao gestor por linha (coluna “Valor” da planilha). Usado como padrão nas próximas ativações — as linhas já
          ativadas mantêm o valor da época.
        </p>
        <CostForm action={setCostAction} current={(cost / 100).toFixed(2).replace(".", ",")} />
      </Card>
      <Card title="Planilha do gestor (Google Planilhas)" className="mt-4">
        <p className="mb-3 text-sm text-muted">
          O sistema lê os números que o gestor coloca na planilha e, ao ativar ou bloquear uma linha, preenche a linha do número
          (Cliente, ICCID, Smart-Dados, Ativação, Venda final, Valor e Vencimento; nome em vermelho quando bloqueada). Login,
          Número, Plano PJ e Forma de pagamento nunca são alterados.
        </p>
        <SheetConfigForm
          action={setSheetConfigAction}
          url={sheet ? `https://docs.google.com/spreadsheets/d/${sheet.spreadsheetId}/edit` : ""}
          tab={sheet?.tab ?? ""}
        />
      </Card>
    </PanelShell>
  );
}

export default function ConfiguracoesPage() {
  return <Suspense fallback={<div className="p-8">Carregando…</div>}><Content /></Suspense>;
}

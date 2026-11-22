import type { Metadata } from "next";
import { Suspense } from "react";
import { getLineCostCents } from "@/lib/server/lines";
import { getSheetConfig, getSheetRules } from "@/lib/server/planilha";
import { requireStaff } from "@/lib/server/staff-auth";
import { setCostAction, setSheetConfigAction, setSheetRulesAction } from "../actions";
import { CostForm, SheetConfigForm } from "../forms";
import { Card, PanelShell } from "../shell";
import { SheetRulesEditor } from "./regras-planilha";

export const metadata: Metadata = { title: "Configurações" };

async function Content() {
  const staff = await requireStaff(["owner"]);
  const [cost, sheet, rules] = await Promise.all([getLineCostCents(), getSheetConfig(), getSheetRules()]);
  return (
    <PanelShell staff={staff}>
      <div className="pn-head">
        <h1>Configurações</h1>
        <p>Só o dono vê esta página.</p>
      </div>
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
          (Cliente, ICCID, Smart-Dados, Ativação, Venda final, Valor e Vencimento) e aplica as regras abaixo. A coluna Número
          nunca é alterada.
        </p>
        <SheetConfigForm
          action={setSheetConfigAction}
          url={sheet ? `https://docs.google.com/spreadsheets/d/${sheet.spreadsheetId}/edit` : ""}
          tab={sheet?.tab ?? ""}
        />
      </Card>
      <Card title="Regras da planilha" className="mt-4">
        <p className="mb-4 text-sm text-muted">
          O que muda na planilha em cada momento. Ex.: ao ativar, a coluna <b>Gestor</b> passa para <b>Gestor Ativo</b>. Se o
          gestor pedir outro texto (ex.: só <b>Ativo</b>) ou outra cor, é só mudar aqui. O nome da coluna tem que ser igual ao
          cabeçalho da planilha (maiúsculas e acentos não importam). Para conferir, use “Testar planilha” em Integrações.
        </p>
        <SheetRulesEditor action={setSheetRulesAction} initial={rules} />
      </Card>
    </PanelShell>
  );
}

export default function ConfiguracoesPage() {
  return <Suspense fallback={<div className="p-8">Carregando…</div>}><Content /></Suspense>;
}

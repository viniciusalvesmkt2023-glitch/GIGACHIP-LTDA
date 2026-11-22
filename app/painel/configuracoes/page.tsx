import type { Metadata } from "next";
import { Suspense } from "react";
import { configPageSettings } from "@/lib/server/planilha";
import { effectiveTemplates } from "@/lib/domain/planilha-modelos";
import { requireStaff } from "@/lib/server/staff-auth";
import { setColumnNamesAction, setCostAction, setSheetConfigAction, setSheetRulesAction, setTemplatesAction } from "../actions";
import { CostForm, SheetConfigForm } from "../forms";
import { Card, PanelShell, PanelLoading } from "../shell";
import { SheetRulesEditor } from "./regras-planilha";
import { ColumnNamesForm } from "./nomes-colunas";
import { TemplatesForm } from "./modelos-planilha";

export const metadata: Metadata = { title: "Configurações" };

async function Content() {
  const staff = await requireStaff(["owner"]);
  const { costCents: cost, sheet, rules, names, templates } = await configPageSettings();
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
      <Card title="Nomes das colunas da planilha" className="mt-4">
        <p className="mb-4 text-sm text-muted">
          O sistema acha cada coluna pelo nome do cabeçalho. Se o gestor mudar um nome (ex.: <b>ICCID</b> virou <b>CD</b>),
          escreva aqui o nome novo e a planilha continua funcionando. Em branco = o sistema reconhece sozinho pelos nomes de
          sempre. Se a coluna tiver nomes diferentes em abas diferentes, separe com “;”. Depois de salvar, confira em
          Integrações → “Testar planilha”.
        </p>
        <ColumnNamesForm action={setColumnNamesAction} initial={names} />
      </Card>
      <Card title="O que escrever em cada coluna (na ativação)" className="mt-4">
        <p className="mb-4 text-sm text-muted">
          Monte o texto de cada coluna com as <b>etiquetas</b> (clique nelas) e o seu próprio texto. Ex.: na coluna Cliente,{" "}
          <b>[Nome do cliente] - pedido [Número do pedido]</b> fica “Beatriz Rocha - pedido 8”. Deixe em branco para o sistema
          não escrever naquela coluna (menos Cliente, que precisa do nome). A prévia embaixo de cada campo mostra como fica.
        </p>
        <TemplatesForm action={setTemplatesAction} initial={effectiveTemplates(templates)} />
      </Card>
      <Card title="Regras da planilha" className="mt-4">
        <p className="mb-4 text-sm text-muted">
          O que muda na planilha em cada momento. Ex.: ao ativar, a coluna <b>Gestor</b> passa para <b>Gestor Ativo</b>. Se o
          gestor pedir outro texto (ex.: só <b>Ativo</b>) ou outra cor, é só mudar aqui. O nome da coluna tem que ser igual ao
          cabeçalho da planilha (maiúsculas e acentos não importam). O texto também aceita as etiquetas acima (ex.:{" "}
          <b>Ativo desde [Data de ativação]</b>). Para conferir, use “Testar planilha” em Integrações.
        </p>
        <SheetRulesEditor action={setSheetRulesAction} initial={rules} />
      </Card>
    </PanelShell>
  );
}

export default function ConfiguracoesPage() {
  return <Suspense fallback={<PanelLoading />}><Content /></Suspense>;
}

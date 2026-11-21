import type { Metadata } from "next";
import { Suspense } from "react";
import { d4signBudget, d4signConfigured } from "@/lib/integrations/d4sign/client";
import { env } from "@/lib/server/env";
import { serviceAccountEmail, sheetsConfigured } from "@/lib/integrations/google/sheets";
import { getSheetConfig } from "@/lib/server/planilha";
import { pendingMigrations } from "@/lib/server/schema-check";
import { requireStaff } from "@/lib/server/staff-auth";
import { listSafesAction, testSheetAction } from "../actions";
import { ActionButton } from "../forms";
import { Card, PanelShell } from "../shell";

export const metadata: Metadata = { title: "Integrações" };

const ok = (b: boolean) => (b ? "✅ configurado" : "❌ falta configurar");

async function Content() {
  const staff = await requireStaff(["owner"]);
  const e = env();
  const configured = d4signConfigured();
  const budget = configured ? await d4signBudget() : null;
  const robot = serviceAccountEmail();
  const [sheet, migrations] = await Promise.all([getSheetConfig(), pendingMigrations()]);
  return (
    <PanelShell staff={staff}>
      <h1 className="text-2xl font-bold">Integrações</h1>
      {migrations.length > 0 ? (
        <Card title="⚠ Migração pendente no banco" className="mt-4 border-danger ring-1 ring-danger">
          <p className="text-sm">
            Partes do sistema dependem destas mudanças no banco e vão falhar até elas serem aplicadas (ex.: a escrita na planilha
            fica “na fila”). Abra o <strong>Supabase → SQL Editor</strong>, cole o conteúdo de cada arquivo abaixo, <strong>na ordem</strong>,
            e clique em Run. Depois recarregue esta página.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {migrations.map((m) => (
              <li key={m.file} className="rounded-lg bg-red-50 p-2">
                <code className="select-all font-semibold">supabase/migrations/{m.file}</code>
                <span className="block text-xs text-muted">Falta: {m.missing.join(", ")}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <p className="mt-2 text-sm text-success">✅ Banco atualizado: todas as migrações recentes (até a 0014) foram aplicadas.</p>
      )}
      <Card title="D4Sign (contratos)" className="mt-4">
        <ul className="space-y-1 text-sm">
          <li>Chaves (D4SIGN_TOKEN_API e D4SIGN_CRYPT_KEY): {ok(configured)}</li>
          <li>Cofre (D4SIGN_SAFE_UUID): {ok(Boolean(e.D4SIGN_SAFE_UUID))}</li>
          <li>Senha do aviso de assinatura (D4SIGN_WEBHOOK_SECRET): {ok(Boolean(e.D4SIGN_WEBHOOK_SECRET))}</li>
          {budget !== null && <li>Chamadas disponíveis na última hora: {budget} de {e.D4SIGN_RATE_LIMIT_PER_HOUR}</li>}
        </ul>
        {configured && (
          <div className="mt-4">
            <p className="mb-2 text-sm text-muted">Use para descobrir o código (uuid) do cofre onde os contratos serão criados. Gasta 1 chamada da D4Sign.</p>
            <ActionButton action={listSafesAction} label="Listar meus cofres" />
          </div>
        )}
      </Card>
      <Card title="Google Planilhas (planilha do gestor)" className="mt-4">
        <ul className="space-y-1 text-sm">
          <li>Usuário robô (GOOGLE_SERVICE_ACCOUNT_JSON): {ok(sheetsConfigured())}</li>
          {robot && (
            <li>
              E-mail do robô — compartilhe a planilha com ele como <strong>Editor</strong>:{" "}
              <code className="select-all break-all rounded bg-surface px-1">{robot}</code>
            </li>
          )}
          <li>Link da planilha (Configurações): {ok(Boolean(sheet))}</li>
        </ul>
        {sheetsConfigured() && sheet && (
          <div className="mt-4">
            <p className="mb-2 text-sm text-muted">Confere se o robô consegue abrir a planilha e quais colunas ele achou. Só lê; não altera nada.</p>
            <ActionButton action={testSheetAction} label="Testar planilha" />
          </div>
        )}
      </Card>
    </PanelShell>
  );
}

export default function IntegracoesPage() {
  return <Suspense fallback={<div className="p-8">Carregando…</div>}><Content /></Suspense>;
}

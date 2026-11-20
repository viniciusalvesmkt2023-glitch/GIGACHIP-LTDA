import type { Metadata } from "next";
import { Suspense } from "react";
import { d4signBudget, d4signConfigured } from "@/lib/integrations/d4sign/client";
import { env } from "@/lib/server/env";
import { requireStaff } from "@/lib/server/staff-auth";
import { listSafesAction } from "../actions";
import { ActionButton } from "../forms";
import { Card, PanelShell } from "../shell";

export const metadata: Metadata = { title: "Integrações" };

const ok = (b: boolean) => (b ? "✅ configurado" : "❌ falta configurar");

async function Content() {
  const staff = await requireStaff(["owner"]);
  const e = env();
  const configured = d4signConfigured();
  const budget = configured ? await d4signBudget() : null;
  return (
    <PanelShell staff={staff}>
      <h1 className="text-2xl font-bold">Integrações</h1>
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
    </PanelShell>
  );
}

export default function IntegracoesPage() {
  return <Suspense fallback={<div className="p-8">Carregando…</div>}><Content /></Suspense>;
}

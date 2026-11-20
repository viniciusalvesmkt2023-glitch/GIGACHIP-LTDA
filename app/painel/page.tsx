import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatBRL } from "@/lib/domain/money";
import { dashboardCounts, STATUS_LABEL } from "@/lib/server/admin";
import { requireStaff } from "@/lib/server/staff-auth";
import { Card, PanelShell } from "./shell";

export const metadata: Metadata = { title: "Visão geral" };

async function Content() {
  const staff = await requireStaff();
  const c = await dashboardCounts(staff);
  const n = (s: string) => c.byStatus[s] ?? 0;
  const tiles: { label: string; value: string | number; href?: string; highlight?: boolean }[] = [
    { label: "Prontos para ativação", value: n("pronto_para_ativacao"), href: "/painel/pedidos?status=pronto_para_ativacao", highlight: true },
    { label: "Identidades para analisar", value: c.identity_review, href: "/painel/pedidos?identidade=1", highlight: true },
    { label: "Pendências", value: n("pendencia"), href: "/painel/pedidos?status=pendencia" },
    { label: "Em andamento (cliente concluindo)", value: n("em_andamento"), href: "/painel/pedidos?status=em_andamento" },
    { label: "Aguardando pagamento", value: n("aguardando_pagamento"), href: "/painel/pedidos?status=aguardando_pagamento" },
    { label: "Linhas ativadas", value: n("ativado"), href: "/painel/pedidos?status=ativado" },
    { label: "Pagamentos confirmados", value: c.paid },
    { label: "Faturamento confirmado", value: formatBRL(c.revenue_cents) },
  ];
  return (
    <PanelShell staff={staff}>
      <h1 className="text-2xl font-bold">Olá, {staff.name.split(" ")[0]}!</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => {
          const body = (
            <Card className={t.highlight && Number(t.value) > 0 ? "border-brand ring-1 ring-brand" : ""}>
              <p className="text-sm text-muted">{t.label}</p>
              <p className="mt-1 text-3xl font-bold">{t.value}</p>
            </Card>
          );
          return t.href ? <Link key={t.label} href={t.href}>{body}</Link> : <div key={t.label}>{body}</div>;
        })}
      </div>
      <p className="mt-6 text-xs text-muted">Status: {Object.entries(c.byStatus).map(([k, v]) => `${STATUS_LABEL[k] ?? k}: ${v}`).join(" · ") || "nenhum pedido ainda"}</p>
    </PanelShell>
  );
}

export default function PainelPage() {
  return <Suspense fallback={<div className="p-8">Carregando…</div>}><Content /></Suspense>;
}

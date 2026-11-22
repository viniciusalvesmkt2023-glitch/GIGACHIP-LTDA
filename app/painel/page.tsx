import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  BadgeCheck,
  Ban,
  CalendarCheck,
  CircleDollarSign,
  ClipboardList,
  IdCard,
  Smartphone,
  TriangleAlert,
  Unlock,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { formatBRL } from "@/lib/domain/money";
import { dashboardCounts } from "@/lib/server/admin";
import { overdueCounts } from "@/lib/server/inadimplencia";
import { lineCounts } from "@/lib/server/lines";
import { requireStaff } from "@/lib/server/staff-auth";
import { PanelShell } from "./shell";

export const metadata: Metadata = { title: "Visão geral" };

type Todo = { label: string; hint: string; value: number; href: string; icon: LucideIcon; tone?: "red" | "green" };

async function Content() {
  const staff = await requireStaff();
  const [c, overdue, lines] = await Promise.all([dashboardCounts(staff), overdueCounts(), lineCounts()]);
  const n = (s: string) => c.byStatus[s] ?? 0;

  // O que precisa de alguém da equipe agora (acende quando tem algo)
  const todo: Todo[] = [
    { label: "Prontos para ativar", hint: "Ativar na Vivo e registrar", value: n("pronto_para_ativacao"), href: "/painel/pedidos?status=pronto_para_ativacao", icon: Zap },
    { label: "Bloquear — sem pagamento", hint: "Bloquear na Vivo", value: overdue.bloquear, href: "/painel/inadimplencia", icon: Ban, tone: "red" },
    { label: "Desbloquear — pagou", hint: "Desbloquear na Vivo", value: overdue.desbloquear, href: "/painel/inadimplencia", icon: Unlock, tone: "green" },
    { label: "Identidades para analisar", hint: "Conferir documento", value: c.identity_review, href: "/painel/pedidos?identidade=1", icon: IdCard },
    { label: "Pendências", hint: "Pedidos com problema", value: n("pendencia"), href: "/painel/pedidos?status=pendencia", icon: TriangleAlert, tone: "red" },
  ];
  const pending = todo.filter((t) => t.value > 0).length;

  // Caminho do cliente (do pagamento à linha ativa)
  const funnel = [
    { label: "Aguardando pagamento", value: n("aguardando_pagamento"), href: "/painel/pedidos?status=aguardando_pagamento" },
    { label: "Cliente concluindo", value: n("em_andamento"), href: "/painel/pedidos?status=em_andamento" },
    { label: "Prontos para ativar", value: n("pronto_para_ativacao"), href: "/painel/pedidos?status=pronto_para_ativacao" },
    { label: "Linhas ativadas", value: n("ativado"), href: "/painel/pedidos?status=ativado" },
  ];
  const maxFunnel = Math.max(1, ...funnel.map((f) => f.value));

  return (
    <PanelShell staff={staff} badges={{ pedidos: n("pronto_para_ativacao"), inadimplencia: overdue.bloquear + overdue.desbloquear }}>
      <div className="pn-head">
        <h1>Olá, {staff.name.split(" ")[0]}! 👋</h1>
        <p>{pending ? `Você tem ${pending} ${pending === 1 ? "tipo de tarefa" : "tipos de tarefa"} esperando.` : "Tudo em dia por aqui."}</p>
      </div>

      <h2 className="pn-section-title">Para fazer agora</h2>
      <div className="pn-todo">
        {todo.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.label} href={t.href} className={`pn-todo-item ${t.value > 0 ? `is-on ${t.tone ? `is-${t.tone}` : ""}` : ""}`}>
              <span className="pn-todo-icon">
                <Icon size={20} />
              </span>
              <strong>{t.value}</strong>
              <span>{t.label}</span>
              <small>{t.hint}</small>
            </Link>
          );
        })}
      </div>

      <h2 className="pn-section-title">Este mês</h2>
      <div className="pn-stats">
        <div className="pn-stat">
          <span><CircleDollarSign size={16} /> Recebido no mês</span>
          <strong>{formatBRL(c.revenue_month_cents)}</strong>
          <small>Total desde o início: {formatBRL(c.revenue_cents)}</small>
        </div>
        <div className="pn-stat">
          <span><BadgeCheck size={16} /> Linhas ativadas no mês</span>
          <strong>{c.activated_month}</strong>
          <small>{lines.ativa ?? 0} linhas ativas hoje</small>
        </div>
        <div className="pn-stat">
          <span><ClipboardList size={16} /> Pedidos novos hoje</span>
          <strong>{c.new_orders_today}</strong>
          <small>{c.paid} pagamentos confirmados no total</small>
        </div>
        <Link href="/painel/linhas?status=disponivel" className="pn-stat">
          <span><Smartphone size={16} /> Números disponíveis</span>
          <strong>{lines.disponivel ?? 0}</strong>
          <small>{lines.ativa ?? 0} ativas · {lines.suspensa ?? 0} bloqueadas</small>
        </Link>
      </div>

      <h2 className="pn-section-title">
        <CalendarCheck size={14} className="mr-1 inline" /> Caminho do cliente
      </h2>
      <div className="pn-funnel">
        {funnel.map((f) => (
          <Link key={f.label} href={f.href}>
            <strong>{f.value}</strong>
            <span>{f.label}</span>
            <i>
              <b style={{ width: `${(f.value / maxFunnel) * 100}%` }} />
            </i>
          </Link>
        ))}
      </div>
    </PanelShell>
  );
}

export default function PainelPage() {
  return (
    <Suspense fallback={<div className="p-8">Carregando…</div>}>
      <Content />
    </Suspense>
  );
}

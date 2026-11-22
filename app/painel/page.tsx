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
import { dashboardCounts, salesSeries } from "@/lib/server/admin";
import { parsePeriodo } from "@/lib/domain/periodo";
import { PeriodoPersonalizado, SalesChart } from "./sales-chart";
import { overdueCounts } from "@/lib/server/inadimplencia";
import { lineCounts } from "@/lib/server/lines";
import { requireStaff } from "@/lib/server/staff-auth";
import { PanelShell, PanelLoading } from "./shell";

export const metadata: Metadata = { title: "Visão geral" };

type Todo = { label: string; hint: string; value: number; href: string; icon: LucideIcon; tone?: "red" | "green" };

const PRESETS = [
  { chave: "hoje", label: "Hoje" },
  { chave: "7", label: "7 dias" },
  { chave: "30", label: "30 dias" },
] as const;

async function Content({ searchParams }: { searchParams: PageProps<"/painel">["searchParams"] }) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const periodo = parsePeriodo({ periodo: str(sp.periodo), de: str(sp.de), ate: str(sp.ate) }, hoje);
  // Cada parte se vira sozinha: se uma consulta falhar ou demorar, o resto da tela aparece
  const seguro = <T,>(nome: string, p: Promise<T>, vazio: T): Promise<T> =>
    p.catch((e: unknown) => {
      console.error(`[visao-geral] ${nome}: ${e instanceof Error ? e.message : String(e)}`);
      return vazio;
    });
  const [c, overdue, lines, serie] = await Promise.all([
    seguro("contagens", dashboardCounts(staff), {
      byStatus: {} as Record<string, number>, identity_review: 0, revenue_cents: 0, paid: 0, revenue_month_cents: 0, activated_month: 0, new_orders_today: 0,
    }),
    seguro("inadimplencia", overdueCounts(), { bloquear: 0, desbloquear: 0 }),
    seguro("linhas", lineCounts(), {} as Record<string, number>),
    seguro("grafico", salesSeries(staff, periodo.de, periodo.ate, periodo.agrupar), [] as Awaited<ReturnType<typeof salesSeries>>),
  ]);
  const totalCents = serie.reduce((a, p) => a + p.receitaCents, 0);
  const totalVendas = serie.reduce((a, p) => a + p.vendas, 0);
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
    <PanelShell staff={staff}>
      <div className="pn-head">
        <h1>Olá, {staff.name.split(" ")[0]}! 👋</h1>
        <p>{pending ? `Você tem ${pending} ${pending === 1 ? "tipo de tarefa" : "tipos de tarefa"} esperando.` : "Tudo em dia por aqui."}</p>
      </div>

      <section className="pn-card sc-card">
        <div className="sc-head">
          <div>
            <h2 className="sc-title">Vendas</h2>
            <p className="sc-sub">{periodo.rotulo}</p>
          </div>
          <div className="sc-filters" role="group" aria-label="Período">
            {PRESETS.map((pr) => (
              <Link key={pr.chave} href={`/painel?periodo=${pr.chave}`} className={`sc-chip ${periodo.chave === pr.chave ? "is-on" : ""}`} scroll={false}>
                {pr.label}
              </Link>
            ))}
            <PeriodoPersonalizado de={periodo.de} ate={periodo.ate} hoje={hoje} aberto={periodo.chave === "personalizado"} />
          </div>
        </div>
        <div className="sc-kpis">
          <div>
            <span>Recebido</span>
            <strong>{formatBRL(totalCents)}</strong>
          </div>
          <div>
            <span>Vendas novas</span>
            <strong>{totalVendas}</strong>
          </div>
          <div>
            <span>{periodo.agrupar === "hora" ? "Melhor horário" : "Média por dia"}</span>
            <strong>
              {periodo.agrupar === "hora"
                ? totalCents
                  ? `${serie.reduce((m, p) => (p.receitaCents > m.receitaCents ? p : m), serie[0]!).bucket.slice(11)}h`
                  : "—"
                : formatBRL(Math.round(totalCents / Math.max(1, serie.length)))}
            </strong>
          </div>
        </div>
        <SalesChart points={serie} porHora={periodo.agrupar === "hora"} />
      </section>

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

export default function PainelPage({ searchParams }: PageProps<"/painel">) {
  return (
    <Suspense fallback={<PanelLoading />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

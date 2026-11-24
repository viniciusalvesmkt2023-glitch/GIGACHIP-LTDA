import { AlertTriangle, ClipboardList, LayoutDashboard, LogOut, Smartphone } from "lucide-react";
import type { ReactNode } from "react";
import { sql } from "@/lib/server/db";
import type { Staff } from "@/lib/server/staff-auth";
import { logoutAction } from "./actions";
import { PanelNav, type NavItem } from "./nav";
import "./panel.css";

const ROLE_LABEL: Record<string, string> = { owner: "Dono", admin: "Administrador", ativador: "Ativador", atendente: "Atendente", financeiro: "Financeiro" };

/** Contadores do menu: pedidos prontos para ativar e linhas para bloquear/desbloquear. */
async function menuBadges(): Promise<Record<string, number>> {
  try {
    // Uma consulta só (cada consulta a mais é uma ida e volta ao banco)
    const [r] = await sql()<{ pedidos: number; inadimplencia: number }[]>`
      select
        (select count(*)::int from public.orders
          where status = 'pronto_para_ativacao'
             or (watch_tv_status = 'pendente' and payment_status in ('confirmed', 'received'))) as pedidos,
        (select count(distinct p.provider_customer_id)::int from public.overdue_payments p
          where p.status = 'em_aberto' and p.value_cents >= coalesce((select (s.value #>> '{}')::int from public.app_settings s where s.key = 'inadimplencia_valor_minimo_cents'), 10000)
            and not exists (select 1 from public.line_blocks b where b.provider_customer_id = p.provider_customer_id and b.unblocked_at is null))
        + (select count(*)::int from public.line_blocks b
          where b.unblocked_at is null
            and not exists (select 1 from public.overdue_payments p where p.provider_customer_id = b.provider_customer_id and p.status = 'em_aberto'
              and p.value_cents >= coalesce((select (s.value #>> '{}')::int from public.app_settings s where s.key = 'inadimplencia_valor_minimo_cents'), 10000)))
        as inadimplencia`;
    return { pedidos: r?.pedidos ?? 0, inadimplencia: r?.inadimplencia ?? 0 };
  } catch {
    return {}; // contador nunca derruba a página
  }
}

/** Moldura do painel: menu lateral (com contadores) + conteúdo. */
export async function PanelShell({ staff, children }: { staff: Staff; children: ReactNode; badges?: Partial<Record<string, number>> }) {
  const badges = await menuBadges();
  const items: NavItem[] = [
    { href: "/painel", label: "Visão geral", icon: "home" },
    { href: "/painel/pedidos", label: "Pedidos", icon: "pedidos", ...(badges?.pedidos ? { badge: badges.pedidos } : {}) },
    { href: "/painel/linhas", label: "Linhas", icon: "linhas" },
    ...(staff.role !== "atendente"
      ? [{ href: "/painel/inadimplencia", label: "Inadimplência", icon: "inadimplencia" as const, ...(badges?.inadimplencia ? { badge: badges.inadimplencia } : {}) }]
      : []),
    ...(staff.role === "owner"
      ? [
          { href: "/painel/equipe", label: "Equipe", icon: "equipe" as const },
          { href: "/painel/integracoes", label: "Integrações", icon: "integracoes" as const },
          { href: "/painel/configuracoes", label: "Configurações", icon: "config" as const },
        ]
      : []),
  ];
  const initials = staff.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="pn-root">
      <PanelNav
        items={items}
        footer={
          <div className="pn-user">
            <span className="pn-avatar">{initials}</span>
            <span className="pn-user-text">
              <strong>{staff.name}</strong>
              <small>{ROLE_LABEL[staff.role]}</small>
            </span>
            <form action={logoutAction}>
              <button className="pn-logout" aria-label="Sair" title="Sair">
                <LogOut size={17} />
              </button>
            </form>
          </div>
        }
      />
      <main className="pn-main">{children}</main>
    </div>
  );
}

/**
 * Tela de espera do painel: menu e contorno aparecem na hora; os dados chegam em seguida.
 * Menu desenhado sem o componente interativo (que lê o endereço da página): a espera é montada
 * antes da página e, nas telas com [id], o Next não deixa ler o endereço nesse momento.
 */
export function PanelLoading() {
  const items = [
    { label: "Visão geral", Icon: LayoutDashboard },
    { label: "Pedidos", Icon: ClipboardList },
    { label: "Linhas", Icon: Smartphone },
    { label: "Inadimplência", Icon: AlertTriangle },
  ];
  return (
    <div className="pn-root">
      <div className="pn-mobilebar">
        <span className="pn-brand">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo pequena e estática */}
          <img src="/logo-gigachip.png" alt="Gigachip" width={124} height={24} />
          <span>painel</span>
        </span>
      </div>
      <aside className="pn-side">
        <div className="pn-side-top">
          <span className="pn-brand">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo pequena e estática */}
            <img src="/logo-gigachip.png" alt="Gigachip" width={140} height={27} />
            <span>painel</span>
          </span>
        </div>
        <nav className="pn-nav" aria-hidden="true">
          {items.map(({ label, Icon }) => (
            <span key={label} className="pn-link">
              <Icon size={18} />
              <span>{label}</span>
            </span>
          ))}
        </nav>
        <div className="pn-side-foot">
          <div className="pn-user pn-sk-user" aria-hidden="true" />
        </div>
      </aside>
      <main className="pn-main" aria-busy="true" aria-label="Carregando">
        <div className="pn-sk pn-sk-title" />
        <div className="pn-sk pn-sk-sub" />
        <div className="pn-sk pn-sk-block" />
        <div className="pn-sk-row">
          <div className="pn-sk pn-sk-card" />
          <div className="pn-sk pn-sk-card" />
          <div className="pn-sk pn-sk-card" />
        </div>
      </main>
    </div>
  );
}

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`pn-card ${className}`}>
      {title && <h2 className="pn-card-title">{title}</h2>}
      {children}
    </section>
  );
}

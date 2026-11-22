import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { sql } from "@/lib/server/db";
import { overdueCounts } from "@/lib/server/inadimplencia";
import type { Staff } from "@/lib/server/staff-auth";
import { logoutAction } from "./actions";
import { PanelNav, type NavItem } from "./nav";
import "./panel.css";

const ROLE_LABEL: Record<string, string> = { owner: "Dono", admin: "Administrador", ativador: "Ativador", atendente: "Atendente", financeiro: "Financeiro" };

/** Contadores do menu: pedidos prontos para ativar e linhas para bloquear/desbloquear. */
async function menuBadges(): Promise<Record<string, number>> {
  try {
    const [[r], o] = await Promise.all([
      sql()<{ n: number }[]>`select count(*)::int as n from public.orders where status = 'pronto_para_ativacao'`,
      overdueCounts(),
    ]);
    return { pedidos: r?.n ?? 0, inadimplencia: o.bloquear + o.desbloquear };
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

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`pn-card ${className}`}>
      {title && <h2 className="pn-card-title">{title}</h2>}
      {children}
    </section>
  );
}

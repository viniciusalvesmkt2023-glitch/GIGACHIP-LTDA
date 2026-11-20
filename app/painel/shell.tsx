import Link from "next/link";
import type { ReactNode } from "react";
import type { Staff } from "@/lib/server/staff-auth";
import { logoutAction } from "./actions";

const ROLE_LABEL: Record<string, string> = { owner: "Dono", admin: "Administrador", ativador: "Ativador", atendente: "Atendente", financeiro: "Financeiro" };

export function PanelShell({ staff, children }: { staff: Staff; children: ReactNode }) {
  return (
    <div>
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/painel" className="font-extrabold">giga<span className="text-brand">chip</span> <span className="text-sm font-medium text-muted">painel</span></Link>
          <nav className="flex gap-4 text-sm font-medium">
            <Link href="/painel" className="hover:text-brand">Visão geral</Link>
            <Link href="/painel/pedidos" className="hover:text-brand">Pedidos</Link>
            <Link href="/painel/linhas" className="hover:text-brand">Linhas</Link>
            {staff.role === "owner" && <Link href="/painel/equipe" className="hover:text-brand">Equipe</Link>}
            {staff.role === "owner" && <Link href="/painel/integracoes" className="hover:text-brand">Integrações</Link>}
            {staff.role === "owner" && <Link href="/painel/configuracoes" className="hover:text-brand">Configurações</Link>}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-muted">{staff.name} · {ROLE_LABEL[staff.role]}</span>
            <form action={logoutAction}><button className="font-medium text-brand">Sair</button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border bg-white p-5 ${className}`}>
      {title && <h2 className="mb-3 font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

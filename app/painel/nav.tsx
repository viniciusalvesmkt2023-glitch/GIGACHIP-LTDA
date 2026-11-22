"use client";

/* eslint-disable @next/next/no-img-element -- logo pequena e estática */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  ClipboardList,
  LayoutDashboard,
  Menu,
  PlugZap,
  Settings,
  Smartphone,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number };

const ICONS = {
  home: LayoutDashboard,
  pedidos: ClipboardList,
  linhas: Smartphone,
  inadimplencia: AlertTriangle,
  equipe: Users,
  integracoes: PlugZap,
  config: Settings,
} satisfies Record<string, LucideIcon>;

/** Menu lateral do painel (gaveta no celular). Marca a página atual. */
export function PanelNav({ items, footer }: { items: NavItem[]; footer: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/painel" ? path === "/painel" : path.startsWith(href));

  const list = (
    <nav className="pn-nav" aria-label="Menu do painel">
      {items.map((it) => {
        const Icon = ICONS[it.icon];
        return (
          <Link key={it.href} href={it.href} onClick={() => setOpen(false)} className={`pn-link ${active(it.href) ? "is-active" : ""}`}>
            <Icon size={18} />
            <span>{it.label}</span>
            {it.badge ? <em>{it.badge}</em> : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* celular: barra no topo + gaveta */}
      <div className="pn-mobilebar">
        <Link href="/painel" className="pn-brand">
          <img src="/logo-gigachip.png" alt="Gigachip" width={124} height={24} />
          <span>painel</span>
        </Link>
        <button type="button" className="pn-burger" onClick={() => setOpen(true)} aria-label="Abrir menu">
          <Menu size={22} />
        </button>
      </div>
      <div className={`pn-overlay ${open ? "is-open" : ""}`} onClick={() => setOpen(false)} aria-hidden="true" />

      <aside className={`pn-side ${open ? "is-open" : ""}`}>
        <div className="pn-side-top">
          <Link href="/painel" className="pn-brand">
            <img src="/logo-gigachip.png" alt="Gigachip" width={140} height={27} />
            <span>painel</span>
          </Link>
          <button type="button" className="pn-close" onClick={() => setOpen(false)} aria-label="Fechar menu">
            <X size={20} />
          </button>
        </div>
        {list}
        <div className="pn-side-foot">{footer}</div>
      </aside>
    </>
  );
}

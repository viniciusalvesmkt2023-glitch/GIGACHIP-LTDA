"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconArrowRight, IconWifi } from "./icons";
import { Logo } from "./ui";

/**
 * Menu do topo — copiado do site EngajaEu (src/components/layout/Header.tsx) e adaptado:
 * barra flutuante que fica transparente no topo e vira "vidro" branco ao rolar, links em
 * maiúsculas, menu suspenso (lá: redes sociais; aqui: planos), botão verde com brilho pulsando
 * e painel no celular. Sem framer-motion: as animações são feitas com CSS.
 */
export type HeaderPlan = { slug: string; name: string; gb: number; price: string };

function smoothScrollTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return false;
  const top = el.getBoundingClientRect().top + window.pageYOffset - 100;
  window.scrollTo({ top, behavior: "smooth" });
  return true;
}

const PLAN_GRADIENT = [
  "from-[#01bafe] to-[#0a7ea4]",
  "from-[#34fba6] to-[#0fae6d]",
  "from-[#d8fd0d] to-[#7cc90a]",
];

function SectionLink({ id, children, onDone, className }: { id: string; children: React.ReactNode; onDone?: () => void; className: string }) {
  return (
    <a
      href={`/#${id}`}
      onClick={(e) => {
        if (window.location.pathname === "/" && smoothScrollTo(id)) {
          e.preventDefault();
          onDone?.();
        }
      }}
      className={className}
    >
      {children}
    </a>
  );
}

function GlowButton({ className = "", onClick }: { className?: string; onClick?: () => void }) {
  // Mesmo botão "com brilho pulsando" do EngajaEu, nas cores da Gigachip (verde-limão da logo)
  return (
    <span className={`relative inline-block ${className}`}>
      <span aria-hidden className="absolute -inset-1 animate-pulse rounded-2xl bg-neon-lime opacity-70 blur-md" />
      <SectionLink
        id="planos"
        onDone={onClick}
        className="relative inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl border-0 bg-neon-lime px-5 text-sm font-black text-ink shadow-[0_10px_30px_-10px_rgb(216_253_13/0.8)] transition hover:brightness-95"
      >
        Ver planos <IconArrowRight className="h-4 w-4" />
      </SectionLink>
    </span>
  );
}

export function HeaderBar({ plans }: { plans: HeaderPlan[] }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const goToPlan = () => {
    setPlansOpen(false);
    setMobileOpen(false);
  };

  const planItem = (p: HeaderPlan, i: number, compact = false) => (
    <Link
      key={p.slug}
      href={`/planos/${p.slug}`}
      onClick={goToPlan}
      className="group flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-slate-50"
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr ${PLAN_GRADIENT[i % 3]} shadow-sm`}>
        <IconWifi className="h-5 w-5 text-ink" />
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-black leading-tight text-slate-900">{p.gb}GB por mês</span>
        {!compact && <span className="text-[11px] font-medium leading-tight text-slate-500">{p.price}/mês · ligações ilimitadas</span>}
      </span>
    </Link>
  );

  const link = "text-[13px] font-semibold uppercase tracking-wider text-ink/60 transition-colors hover:text-ink";

  return (
    <nav
      className={`fixed left-1/2 top-3 z-50 w-[calc(100%-1rem)] max-w-7xl -translate-x-1/2 rounded-2xl border transition-all duration-500 md:top-4 md:w-[95%] ${
        isScrolled
          ? "border-black/5 bg-white/70 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.05)] backdrop-blur-xl md:py-3"
          : "border-transparent bg-transparent py-4 md:py-5"
      }`}
    >
      <div className="mx-auto flex items-center justify-between gap-3 px-4 md:gap-4 md:px-6">
        <Link href="/" className="group flex items-center" aria-label="Gigachip — início">
          <span className="transition-transform group-hover:scale-105"><Logo size={44} /></span>
        </Link>

        <div className="hidden items-center gap-10 lg:flex">
          <SectionLink id="como-funciona" className={link}>Como funciona</SectionLink>

          {/* Planos (menu suspenso) */}
          <div className="relative" onMouseEnter={() => setPlansOpen(true)} onMouseLeave={() => setPlansOpen(false)}>
            <button
              type="button"
              onClick={() => setPlansOpen((v) => !v)}
              className={`flex items-center gap-1 ${link}`}
              aria-haspopup="menu"
              aria-expanded={plansOpen}
            >
              Planos
              <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 transition-transform ${plansOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
            </button>
            <div
              className={`absolute left-1/2 top-full w-80 -translate-x-1/2 pt-3 transition duration-150 ${plansOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1.5 opacity-0"}`}
            >
              <div className="rounded-2xl border border-black/5 bg-white p-2 shadow-2xl">
                {plans.length === 0 ? <p className="p-3 text-xs text-slate-500">Carregando planos…</p> : plans.map((p, i) => planItem(p, i))}
              </div>
            </div>
          </div>

          <SectionLink id="duvidas" className={link}>Dúvidas</SectionLink>
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <GlowButton />
        </div>

        <button className="p-2 text-slate-900 lg:hidden" onClick={() => setMobileOpen((v) => !v)} aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}>
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            {mobileOpen ? <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></> : <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></>}
          </svg>
        </button>
      </div>

      {/* Painel do celular */}
      <div
        className={`absolute left-0 right-0 top-full mx-2 mt-2 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-2xl transition duration-200 lg:hidden ${
          mobileOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-2.5 opacity-0"
        }`}
      >
        <div className="flex flex-col gap-5 p-6">
          <SectionLink id="como-funciona" onDone={() => setMobileOpen(false)} className="px-2 text-lg font-bold text-slate-900">Como funciona</SectionLink>
          <div className="px-2">
            <div className="mb-2 text-lg font-bold text-slate-900">Planos</div>
            <div className="flex flex-col gap-1">{plans.map((p, i) => planItem(p, i, true))}</div>
          </div>
          <SectionLink id="duvidas" onDone={() => setMobileOpen(false)} className="px-2 text-lg font-bold text-slate-900">Dúvidas</SectionLink>
          <div className="flex flex-col gap-3 border-t border-slate-100 pt-5">
            <GlowButton className="w-full" onClick={() => setMobileOpen(false)} />
          </div>
        </div>
      </div>
    </nav>
  );
}

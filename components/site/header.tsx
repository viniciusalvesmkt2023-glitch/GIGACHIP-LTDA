"use client";

/* eslint-disable @next/next/no-img-element -- logo pequena e estática */
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, ChevronDown, Menu, Wifi, X } from "lucide-react";
import { formatBRL } from "@/lib/domain/money";

/**
 * Menu do topo (desenhado no Lovable): barra flutuante transparente no topo que vira "vidro"
 * branco ao rolar, menu suspenso com os planos do cadastro, botão "Ver planos" com o brilho
 * do EngajaEu 2.0 e botão "Área do Cliente"; no celular, painel que abre por cima.
 */
export type HeaderPlan = { slug: string; gb: number; priceCents: number };

/** Ícones dos planos no azul da logo (do mais claro ao mais forte). */
const PLAN_GRADIENT = [
  "from-[#7fdcff] to-[#01bafe]",
  "from-[#33c8ff] to-[#0298de]",
  "from-[#01bafe] to-[#0273b3]",
];

/** Logo do topo: "G | GIGACHIP" em azul. */
export function Logo() {
  return (
    <Link href="/" aria-label="Gigachip — início" className="brand-logo">
      <img src="/logo-gigachip.png" alt="Gigachip" width={166} height={32} className="h-9 w-auto md:h-10" />
    </Link>
  );
}

/** Botão "Ver planos": mesmo efeito do "Teste grátis" do EngajaEu 2.0, em azul. */
function CtaButton({ className = "", onClick }: { className?: string; onClick?: () => void }) {
  return (
    <span className={`gc-glow ${className}`}>
      <Link
        href="/planos"
        onClick={onClick}
        className="gc-glow-button inline-flex min-h-11 w-full items-center justify-center rounded-full px-5 text-sm font-bold"
      >
        <span className="gc-glow-content">Ver planos</span>
      </Link>
    </span>
  );
}

/** Botão branco "Área do Cliente" (estático). */
function ClientAreaButton({ className = "", onClick }: { className?: string; onClick?: () => void }) {
  return (
    <Link
      href="/minha-area"
      onClick={onClick}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-white px-5 text-sm font-bold text-foreground ${className}`}
    >
      Área do Cliente
      <ArrowUpRight size={16} aria-hidden="true" />
    </Link>
  );
}

export function HeaderBar({ plans }: { plans: HeaderPlan[] }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const close = () => {
    setPlansOpen(false);
    setMobileOpen(false);
  };

  const planItem = (p: HeaderPlan, i: number, compact = false) => (
    <Link
      key={p.slug}
      href={`/planos/${p.slug}`}
      onClick={close}
      className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-slate-50"
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr ${PLAN_GRADIENT[i % 3]} shadow-sm`}>
        <Wifi className="h-5 w-5 text-foreground" />
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-bold leading-tight text-slate-900">{p.gb}GB por mês</span>
        {!compact && (
          <span className="text-[11px] font-medium leading-tight text-slate-500">
            {formatBRL(p.priceCents)}/mês · ligações ilimitadas
          </span>
        )}
      </span>
    </Link>
  );

  const link = "text-[15px] font-semibold text-foreground/85 transition-colors hover:text-[#0a82c7]";

  return (
    <nav
      aria-label="Menu principal"
      className={`gc-nav fixed left-1/2 top-3 z-50 w-[calc(100%-1rem)] max-w-7xl -translate-x-1/2 rounded-2xl border transition-all duration-500 md:top-4 md:w-[95%] ${
        scrolled
          ? "border-black/5 bg-white/70 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.05)] backdrop-blur-xl md:py-3"
          : "border-transparent bg-transparent py-4 md:py-5"
      }`}
    >
      <div className="mx-auto flex items-center justify-between gap-3 px-4 md:gap-4 md:px-6">
        <span className="transition-transform hover:scale-105">
          <Logo />
        </span>

        <div className="hidden items-center gap-10 lg:flex">
          <Link href="/#como-funciona" className={link}>
            Como funciona
          </Link>
          <div className="relative" onMouseEnter={() => setPlansOpen(true)} onMouseLeave={() => setPlansOpen(false)}>
            <button
              type="button"
              onClick={() => setPlansOpen((v) => !v)}
              className={`flex items-center gap-1 ${link}`}
              aria-haspopup="menu"
              aria-expanded={plansOpen}
            >
              Planos
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${plansOpen ? "rotate-180" : ""}`} />
            </button>
            <div
              className={`absolute left-1/2 top-full w-80 -translate-x-1/2 pt-3 transition duration-150 ${
                plansOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1.5 opacity-0"
              }`}
            >
              <div className="rounded-2xl border border-black/5 bg-white p-2 shadow-2xl">
                {plans.length === 0 ? (
                  <p className="p-3 text-xs text-slate-500">Carregando planos…</p>
                ) : (
                  plans.map((p, i) => planItem(p, i))
                )}
              </div>
            </div>
          </div>
          <Link href="/perguntas-frequentes" className={link}>
            Dúvidas
          </Link>
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <CtaButton />
          <ClientAreaButton />
        </div>

        <button
          type="button"
          className="p-2 text-slate-900 lg:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Painel do celular */}
      <div
        className={`absolute left-0 right-0 top-full mx-2 mt-2 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-2xl transition duration-200 lg:hidden ${
          mobileOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-2.5 opacity-0"
        }`}
      >
        <div className="flex flex-col gap-5 p-6">
          <Link href="/#como-funciona" onClick={close} className="px-2 text-lg font-bold text-slate-900">
            Como funciona
          </Link>
          <div className="px-2">
            <div className="mb-2 text-lg font-bold text-slate-900">Planos</div>
            <div className="flex flex-col gap-1">{plans.map((p, i) => planItem(p, i, true))}</div>
          </div>
          <Link href="/perguntas-frequentes" onClick={close} className="px-2 text-lg font-bold text-slate-900">
            Dúvidas
          </Link>
          <div className="flex flex-col gap-3 border-t border-slate-100 pt-5">
            <CtaButton className="w-full" onClick={close} />
            <ClientAreaButton className="w-full" onClick={close} />
          </div>
        </div>
      </div>
    </nav>
  );
}

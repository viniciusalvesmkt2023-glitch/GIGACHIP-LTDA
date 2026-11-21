"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Menu em "pílula de vidro" com destaque que desliza até o item sob o mouse (adaptado do
 * "Menu interativo com hover deslizante" do pacote de códigos do site, feito para Elementor).
 * - Entra descendo do topo, com desfoque (animação gc-nav-in).
 * - O destaque volta para o item ativo ao tirar o mouse.
 * - O item ativo acompanha a seção visível ao rolar a página.
 */
type Item = { href: string; label: string };

export function NavPill({ items }: { items: Item[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const refs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [pill, setPill] = useState<{ left: number; width: number; visible: boolean }>({ left: 0, width: 0, visible: false });

  const moveTo = useCallback((i: number | null) => {
    const el = i === null ? null : refs.current[i];
    if (!el || !wrap.current) {
      setPill((p) => ({ ...p, visible: false }));
      return;
    }
    const a = el.getBoundingClientRect();
    const w = wrap.current.getBoundingClientRect();
    setPill({ left: a.left - w.left, width: a.width, visible: true });
  }, []);

  // Seção visível → item ativo
  useEffect(() => {
    const ids = items.map((it) => it.href.split("#")[1]).filter(Boolean);
    const sections = ids.map((id) => document.getElementById(id)).filter((s): s is HTMLElement => Boolean(s));
    if (!sections.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((x, y) => y.intersectionRatio - x.intersectionRatio)[0];
        if (visible) setActive(ids.indexOf(visible.target.id));
        else if (window.scrollY < 200) setActive(null);
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: [0, 0.25, 0.5] },
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, [items]);

  useEffect(() => {
    moveTo(active);
    const onResize = () => moveTo(active);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [active, moveTo]);

  return (
    <div ref={wrap} className="glass-pill nav-in relative flex items-center gap-1 rounded-full p-1.5" onMouseLeave={() => moveTo(active)}>
      <span
        aria-hidden
        className="absolute top-1.5 bottom-1.5 rounded-full border border-ink/[0.06] bg-ink/[0.06] transition-[transform,width,opacity] duration-300 ease-out"
        style={{ width: pill.width, transform: `translateX(${pill.left}px)`, opacity: pill.visible ? 1 : 0, left: 0 }}
      />
      {items.map((it, i) => (
        <Link
          key={it.href}
          ref={(el) => { refs.current[i] = el; }}
          href={it.href}
          onMouseEnter={() => moveTo(i)}
          onFocus={() => moveTo(i)}
          onClick={() => setActive(i)}
          aria-current={active === i ? "true" : undefined}
          className={`relative z-[1] rounded-full px-5 py-2 text-sm transition-colors ${active === i ? "font-semibold text-ink" : "font-medium text-ink/65 hover:text-ink"}`}
        >
          {it.label}
        </Link>
      ))}
    </div>
  );
}

/** Menu do celular: botão "Menu" que abre a lista. */
export function NavMobile({ items }: { items: Item[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative md:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        className="glass-pill flex h-10 w-10 items-center justify-center rounded-full text-ink"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          {open ? <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></> : <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>}
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-12 w-56 overflow-hidden rounded-2xl bg-white p-2 shadow-[0_20px_50px_-20px_rgb(4_7_13/0.35)] ring-1 ring-ink/[0.07]">
          {items.map((it) => (
            <Link key={it.href} href={it.href} onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 font-medium text-ink hover:bg-ink/[0.05]">
              {it.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-4 ${className}`}>{children}</div>;
}

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60";

export const buttonStyles = {
  primary: `${buttonBase} bg-brand text-white hover:bg-brand-strong`,
  secondary: `${buttonBase} border border-border bg-white text-foreground hover:bg-surface`,
  whatsapp: `${buttonBase} bg-[#1f8f4e] text-white hover:bg-[#18733f]`,
  /** Botão principal do site: degradê da marca com texto preto (contraste alto) */
  neon: `${buttonBase} rounded-full bg-neon text-ink shadow-[0_8px_30px_-6px_rgb(52_251_166/0.55)] hover:brightness-105`,
  /** Botão escuro (pílula) para fundo claro */
  ink: `${buttonBase} rounded-full bg-ink text-white hover:bg-ink-soft`,
  /** Azul da logo */
  blue: `${buttonBase} rounded-full bg-logo-blue-deep text-white hover:brightness-110`,
  /** Contorno discreto (fundo claro) */
  outline: `${buttonBase} rounded-full border border-ink/15 bg-white text-ink hover:border-ink/40`,
  /** Botão secundário sobre fundo preto */
  ghostDark: `${buttonBase} rounded-full border border-white/20 bg-white/5 text-white hover:bg-white/10`,
};

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof buttonStyles }) {
  return <Link {...props} className={`${buttonStyles[variant]} ${className}`} />;
}

export function SectionTitle({ eyebrow, title, subtitle, align = "center", dark = false }: {
  eyebrow?: string; title: ReactNode; subtitle?: string; align?: "center" | "left"; dark?: boolean;
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      {eyebrow && <p className={`eyebrow ${dark ? "text-neon-green" : "text-brand"}`}>{eyebrow}</p>}
      <h2 className={`font-heading mt-3 text-4xl font-extrabold sm:text-5xl ${dark ? "text-white" : "text-ink"}`}>{title}</h2>
      {subtitle && <p className={`mt-4 text-lg ${dark ? "text-white/65" : "text-muted"}`}>{subtitle}</p>}
    </div>
  );
}

/** Logo redonda + nome GIGACHIP (para fundo escuro ou claro) */
export function Logo({ dark = false, size = 36 }: { dark?: boolean; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- logo pequena e estática */}
      <img src="/brand/gigachip-logo-192.png" alt="" width={size} height={size} className="rounded-full" />
      <span className={`font-display text-xl font-bold italic tracking-tight ${dark ? "text-white" : "text-ink"}`}>
        GIGA<span className="text-logo-blue">CHIP</span>
      </span>
    </span>
  );
}

/** Seta ↗ (do pacote de códigos: "right-down" girada). */
function ArrowUpRight() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <g transform="rotate(-90 12 12)">
        <path d="M7.146 7.146a.75.75 0 0 1 1.061 0l8.5 8.5a.75.75 0 1 1-1.06 1.061l-8.5-8.5a.75.75 0 0 1 0-1.06z" />
        <path d="M16.177 6.427a.75.75 0 0 1 .75.75v9a.75.75 0 0 1-.75.75h-9a.75.75 0 0 1 0-1.5h8.25v-8.25a.75.75 0 0 1 .75-.75z" />
      </g>
    </svg>
  );
}

/** Conteúdo do botão com anel de luz (use dentro de um link com className "shine"). */
export function ShineInner({ children }: { children: ReactNode }) {
  return (
    <>
      <span className="shine-fill" aria-hidden />
      <span>{children}</span>
      <span className="shine-arrow"><ArrowUpRight /><ArrowUpRight /></span>
    </>
  );
}

/** Botão azul (da logo) com anel de luz girando (efeito do pacote de códigos). */
export function ShineButton({ href, children, size = "md", className = "" }: {
  href: string; children: ReactNode; size?: "sm" | "md" | "lg"; className?: string;
}) {
  const pad = size === "sm" ? "px-5 py-2.5 text-sm" : size === "lg" ? "px-9 py-4 text-base" : "px-7 py-3.5 text-[15px]";
  return (
    <span className={`shine-wrap ${className}`}>
      <Link href={href} className={`shine ${pad}`}>
        <ShineInner>{children}</ShineInner>
      </Link>
    </span>
  );
}

/** Texto em destaque (fundo clarinho, bordas laterais, texto em degradê azul e bolinhas nos cantos). */
export function Destaque({ children, dark = false, className = "" }: { children: ReactNode; dark?: boolean; className?: string }) {
  return (
    <span className={`destaque ${dark ? "destaque-escuro" : ""} ${className}`}>
      <span className="destaque-texto">{children}</span>
    </span>
  );
}

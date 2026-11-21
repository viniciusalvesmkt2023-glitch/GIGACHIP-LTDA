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
  /** Verde-limão da logo com texto preto (para fundo preto) */
  lime: `${buttonBase} rounded-full bg-neon-lime text-ink hover:brightness-95`,
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
        GIGA<span className={dark ? "text-neon-green" : "text-emerald-500"}>CHIP</span>
      </span>
    </span>
  );
}

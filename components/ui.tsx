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
  neon: `${buttonBase} bg-neon text-ink shadow-[0_0_24px_rgb(52_251_166/0.35)] hover:brightness-110`,
  /** Botão secundário sobre fundo preto */
  ghostDark: `${buttonBase} border border-white/25 text-white hover:bg-white/10`,
};

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof buttonStyles }) {
  return <Link {...props} className={`${buttonStyles[variant]} ${className}`} />;
}

export function SectionTitle({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow && <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-brand">{eyebrow}</p>}
      <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-3 text-muted">{subtitle}</p>}
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
        GIGA<span className={dark ? "text-neon" : "text-brand"}>CHIP</span>
      </span>
    </span>
  );
}

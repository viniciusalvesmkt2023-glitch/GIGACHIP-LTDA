import type { ReactNode } from "react";
import { formatBRL } from "@/lib/domain/money";
import type { PublicPlan } from "@/lib/server/catalog";
import { IconArrowRight, IconCheck, IconGift, IconPhone, IconShield, IconSignal, IconWifi } from "./icons";
import { ButtonLink } from "./ui";

/** Ícone de cada benefício pelo texto (os benefícios vêm do cadastro do plano). */
function benefitIcon(text: string): ReactNode {
  const t = text.toLowerCase();
  const cls = "h-[18px] w-[18px]";
  if (t.includes("bônus") || t.includes("bonus")) return <IconGift className={cls} />;
  if (t.includes("internet") || t.includes("gb")) return <IconWifi className={cls} />;
  if (t.includes("liga")) return <IconPhone className={cls} />;
  if (t.includes("fidelidade")) return <IconShield className={cls} />;
  if (t.includes("vivo") || t.includes("rede")) return <IconSignal className={cls} />;
  return <IconCheck className={cls} />;
}

export function PlanCard({ plan, highlight = false }: { plan: PublicPlan; highlight?: boolean }) {
  const card = (
    <article className="relative flex h-full flex-col rounded-[26px] bg-white p-7 shadow-[0_1px_2px_rgb(4_7_13/0.04),0_20px_40px_-20px_rgb(4_7_13/0.18)] ring-1 ring-border">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted">{plan.name}</p>
        {highlight ? (
          <span className="rounded-full bg-neon px-3 py-1 text-xs font-bold text-ink">Mais escolhido</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
            <IconPhone className="h-3.5 w-3.5" /> Com ligação
          </span>
        )}
      </div>
      <p className="font-heading mt-4 flex items-baseline gap-1 text-ink">
        <span className="text-7xl font-extrabold leading-none">{plan.dataTotalGb}</span>
        <span className="text-2xl font-bold text-muted">GB</span>
      </p>
      <p className="mt-2 text-sm text-muted">de internet por mês</p>

      <ul className="mt-6 flex-1 space-y-3 text-[15px]">
        {plan.benefits.map((b) => (
          <li key={b} className="flex items-start gap-3">
            <span className="mt-0.5 text-brand">{benefitIcon(b)}</span>
            <span className="text-ink/85">{b}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 border-t border-border pt-5">
        <p className="text-xs font-medium text-muted">Mensalidade</p>
        <p className="font-heading mt-1 text-ink">
          <span className="text-4xl font-extrabold">{formatBRL(plan.monthlyPriceCents)}</span>
          <span className="ml-1 text-sm font-medium text-muted">/mês</span>
        </p>
      </div>
      <ButtonLink href={`/contratar/${plan.slug}`} variant={highlight ? "neon" : "ink"} className="mt-6 w-full py-3.5 text-base">
        Quero este plano <IconArrowRight className="h-4 w-4" />
      </ButtonLink>
      <ButtonLink href={`/planos/${plan.slug}`} variant="secondary" className="mt-2 w-full rounded-full border-transparent text-muted hover:text-ink">
        Ver detalhes
      </ButtonLink>
    </article>
  );
  // Destaque: borda no degradê da marca
  return highlight ? <div className="rounded-[28px] bg-neon p-[2px] shadow-[0_24px_60px_-20px_rgb(52_251_166/0.55)]">{card}</div> : card;
}

export function PlanGridSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-3" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[34rem] animate-pulse rounded-[26px] border border-border bg-surface" />
      ))}
    </div>
  );
}

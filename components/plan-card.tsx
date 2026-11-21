import { formatBRL } from "@/lib/domain/money";
import type { PublicPlan } from "@/lib/server/catalog";
import { ButtonLink } from "./ui";

export function PlanCard({ plan, highlight = false }: { plan: PublicPlan; highlight?: boolean }) {
  const [reais, centavos] = formatBRL(plan.monthlyPriceCents).replace("R$ ", "").split(",");
  return (
    <article
      className={`relative flex flex-col overflow-hidden rounded-3xl p-6 ${
        highlight
          ? "bg-ink text-white shadow-[0_0_0_1px_rgb(52_251_166/0.5),0_20px_50px_-12px_rgb(1_186_254/0.45)] md:-my-3 md:py-9"
          : "border border-border bg-white shadow-sm"
      }`}
    >
      <div className={`absolute inset-x-0 top-0 h-1.5 ${highlight ? "bg-neon" : "bg-neon opacity-70"}`} />
      {highlight && (
        <span className="absolute right-5 top-5 rounded-full bg-neon px-3 py-1 text-xs font-bold text-ink">Mais escolhido</span>
      )}
      <h3 className={`text-sm font-semibold uppercase tracking-wider ${highlight ? "text-white/70" : "text-muted"}`}>{plan.name}</h3>
      <p className="font-display mt-2 text-5xl font-bold italic tracking-tight">
        <span className={highlight ? "text-neon" : "text-ink"}>{plan.dataTotalGb}</span>
        <span className="text-2xl">GB</span>
      </p>
      <p className={`text-sm ${highlight ? "text-white/60" : "text-muted"}`}>
        {plan.dataBaseGb}GB + {plan.dataBonusGb}GB de bônus todo mês
      </p>
      <p className="mt-6">
        <span className="align-top text-sm font-medium">R$</span>
        <span className="text-4xl font-bold">{reais}</span>
        <span className="font-semibold">,{centavos}</span>
        <span className={`text-sm ${highlight ? "text-white/60" : "text-muted"}`}>/mês</span>
      </p>
      <ul className="mt-6 flex-1 space-y-2.5 text-sm">
        {plan.benefits.map((b) => (
          <li key={b} className="flex gap-2.5">
            <span aria-hidden className={`mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full text-[10px] font-bold ${highlight ? "bg-neon text-ink" : "bg-brand-soft text-brand"}`}>✓</span>
            <span className={highlight ? "text-white/85" : ""}>{b}</span>
          </li>
        ))}
      </ul>
      <div className="mt-7 grid gap-2">
        <ButtonLink href={`/contratar/${plan.slug}`} variant={highlight ? "neon" : "primary"} className="py-3.5">Contratar</ButtonLink>
        <ButtonLink href={`/planos/${plan.slug}`} variant={highlight ? "ghostDark" : "secondary"}>Ver detalhes</ButtonLink>
      </div>
    </article>
  );
}

export function PlanGridSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-3" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[30rem] animate-pulse rounded-3xl border border-border bg-surface" />
      ))}
    </div>
  );
}

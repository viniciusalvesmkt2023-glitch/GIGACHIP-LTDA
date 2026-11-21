import { formatBRL } from "@/lib/domain/money";
import type { PublicPlan } from "@/lib/server/catalog";
import { IconArrowRight, IconCheck } from "./icons";
import { ButtonLink, ShineButton } from "./ui";

export function PlanCard({ plan, highlight = false }: { plan: PublicPlan; highlight?: boolean }) {
  const dark = highlight;
  return (
    <article
      className={`relative flex h-full flex-col rounded-3xl p-7 sm:p-8 ${
        dark ? "bg-ink text-white" : "border border-ink/10 bg-white text-ink"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className={`text-sm font-medium ${dark ? "text-white/60" : "text-ink/55"}`}>{plan.name}</p>
        {highlight && <span className="rounded-full bg-neon-lime px-2.5 py-1 text-xs font-bold text-ink">Mais escolhido</span>}
      </div>

      <p className="font-heading mt-5 flex items-baseline gap-1.5">
        <span className="text-6xl font-extrabold leading-none sm:text-7xl">{plan.dataTotalGb}</span>
        <span className={`text-xl font-bold ${dark ? "text-white/50" : "text-ink/40"}`}>GB</span>
      </p>
      <p className={`mt-2 text-sm ${dark ? "text-white/60" : "text-ink/55"}`}>
        {plan.dataBaseGb}GB + {plan.dataBonusGb}GB de bônus todo mês
      </p>

      <p className="font-heading mt-7">
        <span className="text-4xl font-extrabold">{formatBRL(plan.monthlyPriceCents)}</span>
        <span className={`ml-1 text-sm ${dark ? "text-white/55" : "text-ink/50"}`}>/mês</span>
      </p>

      <ul className={`mt-7 flex-1 space-y-3 border-t pt-6 text-[15px] ${dark ? "border-white/10" : "border-ink/[0.08]"}`}>
        {plan.benefits.map((b) => (
          <li key={b} className="flex items-start gap-3">
            <IconCheck className={`mt-0.5 h-[18px] w-[18px] flex-none ${dark ? "text-neon-lime" : "text-ink"}`} />
            <span className={dark ? "text-white/85" : "text-ink/80"}>{b}</span>
          </li>
        ))}
      </ul>

      {dark ? (
        <ShineButton href={`/contratar/${plan.slug}`} className="mt-8 w-full">Quero este plano</ShineButton>
      ) : (
        <ButtonLink href={`/contratar/${plan.slug}`} variant="ink" className="mt-8 w-full py-3.5 text-base">
          Quero este plano <IconArrowRight className="h-4 w-4" />
        </ButtonLink>
      )}
      <a href={`/planos/${plan.slug}`} className={`mt-3 text-center text-sm underline-offset-4 hover:underline ${dark ? "text-white/60" : "text-ink/55"}`}>
        Ver detalhes do plano
      </a>
    </article>
  );
}

export function PlanGridSkeleton() {
  return (
    <div className="grid gap-5 md:grid-cols-3" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[34rem] animate-pulse rounded-3xl bg-surface" />
      ))}
    </div>
  );
}

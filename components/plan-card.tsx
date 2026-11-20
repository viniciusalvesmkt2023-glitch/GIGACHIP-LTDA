import { formatBRL } from "@/lib/domain/money";
import type { PublicPlan } from "@/lib/server/catalog";
import { ButtonLink } from "./ui";

export function PlanCard({ plan, highlight = false }: { plan: PublicPlan; highlight?: boolean }) {
  const [reais, centavos] = formatBRL(plan.monthlyPriceCents).replace("R$ ", "").split(",");
  return (
    <article
      className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
        highlight ? "border-brand ring-2 ring-brand" : "border-border"
      }`}
    >
      {highlight && (
        <span className="absolute -top-3 left-6 rounded-full bg-accent px-3 py-1 text-xs font-bold text-white">
          Mais escolhido
        </span>
      )}
      <h3 className="text-lg font-semibold">{plan.name}</h3>
      <p className="mt-1 text-4xl font-extrabold tracking-tight">
        {plan.dataTotalGb}
        <span className="text-xl">GB</span>
      </p>
      <p className="text-sm text-muted">
        {plan.dataBaseGb}GB + {plan.dataBonusGb}GB de bônus todo mês
      </p>
      <p className="mt-5">
        <span className="text-sm font-medium align-top">R$</span>
        <span className="text-3xl font-bold">{reais}</span>
        <span className="font-semibold">,{centavos}</span>
        <span className="text-sm text-muted">/mês</span>
      </p>
      <ul className="mt-5 flex-1 space-y-2 text-sm">
        {plan.benefits.map((b) => (
          <li key={b} className="flex gap-2">
            <span aria-hidden className="text-success">✓</span>
            {b}
          </li>
        ))}
      </ul>
      <div className="mt-6 grid gap-2">
        <ButtonLink href={`/contratar/${plan.slug}`}>Contratar</ButtonLink>
        <ButtonLink href={`/planos/${plan.slug}`} variant="secondary">
          Detalhes
        </ButtonLink>
      </div>
    </article>
  );
}

export function PlanGridSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-3" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-96 animate-pulse rounded-2xl border border-border bg-surface" />
      ))}
    </div>
  );
}

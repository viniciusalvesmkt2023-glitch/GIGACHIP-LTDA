import Link from "next/link";
import { formatBRL } from "@/lib/domain/money";
import type { PublicPlan } from "@/lib/server/catalog";
import { IconArrowRight, IconCheck, IconStar } from "./icons";

/** Cartão de plano (layout do Lovable). Os dados vêm do cadastro de planos. */
export function PlanCard({ plan, highlight = false }: { plan: PublicPlan; highlight?: boolean }) {
  // O 1º benefício do cadastro é "XGB de internet por mês", que o cartão já mostra em destaque
  const benefits = plan.benefits.filter((b) => !/de internet por m[eê]s/i.test(b));
  return (
    <article className={`plan-card ${highlight ? "featured" : ""}`}>
      {highlight && (
        <div className="plan-badge"><IconStar /> Mais escolhido</div>
      )}
      <h3 className="plan-title">PLANO GIGACHIP</h3>
      <div className="plan-gb">{plan.dataTotalGb}<span>GB</span></div>
      <p className="plan-bonus">{plan.dataBaseGb}GB + {plan.dataBonusGb}GB de bônus todo mês</p>
      <div className="plan-price">{formatBRL(plan.monthlyPriceCents)}<small> /mês</small></div>
      <ul className="benefit-list">
        {benefits.map((b) => (
          <li key={b}><IconCheck />{b}</li>
        ))}
      </ul>
      <Link href={`/contratar/${plan.slug}`} className={`btn w-full ${highlight ? "btn-primary" : "btn-outline"}`}>
        Quero este plano <IconArrowRight />
      </Link>
      <Link href={`/planos/${plan.slug}`} className="plan-details">Ver detalhes <span aria-hidden>↗</span></Link>
    </article>
  );
}

export function PlanGridSkeleton() {
  return (
    <div className="plan-grid" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[34rem] animate-pulse rounded-[22px] bg-[var(--s-soft)]" />
      ))}
    </div>
  );
}

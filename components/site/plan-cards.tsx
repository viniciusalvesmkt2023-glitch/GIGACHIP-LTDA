/* eslint-disable @next/next/no-img-element -- logo pequena e estática */
import { Crown, PhoneCall, ShieldCheck, Smartphone, Wifi } from "lucide-react";
import type { PublicPlan } from "@/lib/server/catalog";
import { PlanWatchFoot } from "./plan-watch";

/**
 * Cartões de plano (desenhados no Lovable, no layout dos cartões da Vivo). Os números vêm do
 * cadastro de planos. O plano do meio é o "MAIS ESCOLHIDO".
 */
export function PlanCards({ plans }: { plans: PublicPlan[] }) {
  const meio = Math.floor(plans.length / 2);
  return (
    <div className="gc-plan-grid">
      {plans.map((p, i) => (
        <PlanCard key={p.id} plan={p} destaque={plans.length >= 3 && i === meio} />
      ))}
    </div>
  );
}

function PlanCard({ plan: p, destaque }: { plan: PublicPlan; destaque: boolean }) {
  const porGb = (p.monthlyPriceCents / 100 / p.dataTotalGb).toFixed(2).replace(".", ",");
  const esim = p.simTypesAllowed.includes("esim");
  const fisico = p.simTypesAllowed.some((t) => t !== "esim");
  return (
    <article className={`gc-plan ${destaque ? "is-featured" : ""}`}>
      {destaque && (
        <span className="gc-plan-badge">
          <Crown size={14} fill="currentColor" aria-hidden="true" />
          MAIS ESCOLHIDO
        </span>
      )}
      <div className="gc-plan-head">
        <img src="/vivo-logo.png" alt="Rede Vivo" className="gc-plan-logo" width={96} height={30} />
        <span className="gc-plan-pill">
          <PhoneCall size={14} /> Ligações ilimitadas
        </span>
      </div>

      <p className="gc-plan-name">Plano Gigachip {p.dataTotalGb} GB</p>
      <div className="gc-plan-gb">
        {p.dataTotalGb}
        <span>GB</span>
      </div>
      <p className="gc-plan-sub">de internet por mês</p>

      <ul className="gc-plan-list">
        <li>
          <Wifi size={20} className="gc-plan-ico" />
          <span>
            Internet <b>{p.dataBaseGb} GB</b>
            {p.dataBonusGb > 0 && (
              <>
                {" "}+ <b>{p.dataBonusGb} GB de bônus</b>
              </>
            )}
          </span>
        </li>
        <li>
          <ShieldCheck size={20} className="gc-plan-ico" />
          <span>Sem fidelidade e sem multa</span>
        </li>
        <li>
          <Smartphone size={20} className="gc-plan-ico" />
          <span>{esim && fisico ? "eSIM ou chip físico" : esim ? "eSIM" : "Chip físico"}</span>
        </li>
      </ul>

      <PlanWatchFoot slug={p.slug} priceCents={p.monthlyPriceCents} porGb={porGb} />
    </article>
  );
}

/** Enquanto os planos carregam. */
export function PlanCardsSkeleton() {
  return (
    <div className="gc-plan-grid" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="gc-plan h-[560px] animate-pulse" />
      ))}
    </div>
  );
}

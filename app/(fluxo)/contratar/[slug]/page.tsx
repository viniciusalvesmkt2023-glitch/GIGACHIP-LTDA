import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getActivePlanBySlug, listActivePlans, type PublicPlan } from "@/lib/server/catalog";
import { watchFromQuery } from "@/lib/domain/watch-tv";
import { CheckoutForm, type CheckoutPlan } from "./checkout-form";

export const metadata: Metadata = { title: "Contratar", robots: { index: false } };

const toCheckout = (p: PublicPlan): CheckoutPlan => ({
  slug: p.slug,
  gb: p.dataTotalGb,
  baseGb: p.dataBaseGb,
  bonusGb: p.dataBonusGb,
  priceCents: p.monthlyPriceCents,
  allowEsim: p.simTypesAllowed.includes("esim"),
  allowPhysical: p.simTypesAllowed.includes("physical"),
});

async function Checkout({ params, searchParams }: PageProps<"/contratar/[slug]">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [plan, all] = await Promise.all([getActivePlanBySlug(slug), listActivePlans()]);
  if (!plan) notFound();
  const plans = all.some((p) => p.slug === plan.slug) ? all : [plan, ...all];
  // "?tv=1": o cliente marcou a Watch TV no cartão do plano (D44). Sem isso, começa desmarcada.
  return <CheckoutForm plans={plans.map(toCheckout)} initialSlug={plan.slug} initialWatchTv={watchFromQuery(sp.tv)} />;
}

export default function ContratarPage({ params, searchParams }: PageProps<"/contratar/[slug]">) {
  return (
    <Suspense fallback={<div className="ck-page" style={{ minHeight: 700 }} />}>
      <Checkout params={params} searchParams={searchParams} />
    </Suspense>
  );
}

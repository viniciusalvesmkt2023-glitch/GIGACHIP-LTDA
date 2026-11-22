import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getActivePlanBySlug, listActivePlans, type PublicPlan } from "@/lib/server/catalog";
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

async function Checkout({ params }: { params: PageProps<"/contratar/[slug]">["params"] }) {
  const { slug } = await params;
  const [plan, all] = await Promise.all([getActivePlanBySlug(slug), listActivePlans()]);
  if (!plan) notFound();
  const plans = all.some((p) => p.slug === plan.slug) ? all : [plan, ...all];
  return <CheckoutForm plans={plans.map(toCheckout)} initialSlug={plan.slug} />;
}

export default function ContratarPage({ params }: PageProps<"/contratar/[slug]">) {
  return (
    <Suspense fallback={<div className="ck-page" style={{ minHeight: 700 }} />}>
      <Checkout params={params} />
    </Suspense>
  );
}

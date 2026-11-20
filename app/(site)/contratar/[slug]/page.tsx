import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/ui";
import { formatBRL } from "@/lib/domain/money";
import { getActivePlanBySlug } from "@/lib/server/catalog";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Contratar", robots: { index: false } };

async function Checkout({ params }: { params: PageProps<"/contratar/[slug]">["params"] }) {
  const { slug } = await params;
  const plan = await getActivePlanBySlug(slug);
  if (!plan) notFound();
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
      <div>
        <h1 className="text-3xl font-bold">Contratar {plan.name}</h1>
        <p className="mt-2 text-muted">Leva menos de 2 minutos. Depois do pagamento, enviamos o passo a passo para o seu e-mail.</p>
        <div className="mt-8">
          <CheckoutForm
            planSlug={plan.slug}
            allowEsim={plan.simTypesAllowed.includes("esim")}
            allowPhysical={plan.simTypesAllowed.includes("physical")}
          />
        </div>
      </div>
      <aside className="h-fit rounded-2xl border border-border bg-surface p-6 lg:sticky lg:top-24">
        <p className="text-sm font-semibold text-muted">Resumo</p>
        <p className="mt-2 text-xl font-bold">{plan.name}</p>
        <p className="text-sm text-muted">{plan.dataTotalGb}GB por mês · ligações ilimitadas</p>
        <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
          <span className="text-sm">1ª mensalidade hoje</span>
          <span className="text-2xl font-extrabold">{formatBRL(plan.monthlyPriceCents)}</span>
        </div>
        <p className="mt-3 text-xs text-muted">
          As próximas mensalidades vencem todo mês no mesmo dia de hoje. Sem fidelidade.
        </p>
      </aside>
    </div>
  );
}

export default function ContratarPage({ params }: PageProps<"/contratar/[slug]">) {
  return (
    <Container className="py-12">
      <Suspense fallback={<div className="h-[600px] animate-pulse rounded-2xl bg-surface" />}>
        <Checkout params={params} />
      </Suspense>
    </Container>
  );
}

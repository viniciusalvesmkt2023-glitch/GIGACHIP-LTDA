import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ButtonLink, Container } from "@/components/ui";
import { formatBRL } from "@/lib/domain/money";
import { getActivePlanBySlug } from "@/lib/server/catalog";

export async function generateMetadata({ params }: PageProps<"/planos/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const plan = await getActivePlanBySlug(slug);
  if (!plan) return { title: "Plano não encontrado" };
  return {
    title: plan.seoTitle ?? `${plan.name} — ${plan.dataTotalGb}GB por ${formatBRL(plan.monthlyPriceCents)}/mês`,
    description:
      plan.seoDescription ??
      `${plan.dataBaseGb}GB + ${plan.dataBonusGb}GB de bônus todo mês, ligações ilimitadas e sem fidelidade. Contrate online.`,
  };
}

async function PlanDetail({ params }: { params: PageProps<"/planos/[slug]">["params"] }) {
  const { slug } = await params;
  const plan = await getActivePlanBySlug(slug);
  if (!plan) notFound();
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">Plano na rede Vivo</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">{plan.name}</h1>
        <p className="mt-3 text-lg text-muted">
          {plan.dataBaseGb}GB + {plan.dataBonusGb}GB de bônus = <strong>{plan.dataTotalGb}GB por mês</strong>, com
          ligações ilimitadas.
        </p>
        {plan.description && <p className="mt-6 leading-relaxed">{plan.description}</p>}
        <h2 className="mt-10 text-xl font-semibold">O que está incluído</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {plan.benefits.map((b) => (
            <li key={b} className="rounded-xl border border-border p-4 text-sm">
              <span aria-hidden className="mr-2 text-success">✓</span>
              {b}
            </li>
          ))}
        </ul>
        <h2 className="mt-10 text-xl font-semibold">Como contratar</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-muted">
          <li>Preencha o cadastro e escolha eSIM ou chip físico.</li>
          <li>Pague a 1ª mensalidade por PIX ou cartão.</li>
          <li>Confirme sua identidade, assine o contrato digital e informe os dados do aparelho.</li>
          <li>Nossa equipe ativa sua linha e você recebe a confirmação.</li>
        </ol>
      </div>
      <aside className="h-fit rounded-2xl border border-border bg-white p-6 shadow-sm lg:sticky lg:top-24">
        <p className="text-sm text-muted">Mensalidade</p>
        <p className="text-4xl font-extrabold">{formatBRL(plan.monthlyPriceCents)}</p>
        <p className="text-sm text-muted">por mês · sem fidelidade</p>
        <ButtonLink href={`/contratar/${plan.slug}`} className="mt-6 w-full">
          Contratar agora
        </ButtonLink>
        <p className="mt-4 text-xs text-muted">
          Vencimento todo mês no mesmo dia da contratação. Pagamento por PIX ou cartão de crédito.
        </p>
      </aside>
    </div>
  );
}

export default function PlanPage({ params }: PageProps<"/planos/[slug]">) {
  return (
    <Container className="py-16">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-surface" />}>
        <PlanDetail params={params} />
      </Suspense>
    </Container>
  );
}

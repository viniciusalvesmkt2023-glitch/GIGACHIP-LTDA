import type { Metadata } from "next";
import { Suspense } from "react";
import { PlanCards, PlanCardsSkeleton } from "@/components/site/plan-cards";
import { Container, SectionTitle } from "@/components/ui";
import { formatBRL } from "@/lib/domain/money";
import { listActivePlans } from "@/lib/server/catalog";

export const metadata: Metadata = {
  title: "Planos",
  description: "Compare os planos de internet móvel na rede Vivo: 200GB, 300GB e 400GB por mês, com ligações ilimitadas e sem fidelidade.",
};

async function Comparison() {
  const plans = await listActivePlans();
  const rows: [string, (p: (typeof plans)[number]) => string][] = [
    ["Internet por mês", (p) => `${p.dataTotalGb}GB`],
    ["Franquia + bônus", (p) => `${p.dataBaseGb}GB + ${p.dataBonusGb}GB`],
    ["Ligações", () => "Ilimitadas"],
    ["Fidelidade", () => "Não tem"],
    ["Tipo de chip", (p) => p.simTypesAllowed.map((t) => (t === "esim" ? "eSIM" : "Chip físico")).join(" ou ")],
    ["Mensalidade", (p) => formatBRL(p.monthlyPriceCents)],
  ];
  return (
    <>
      <PlanCards plans={plans} />
      <div className="mt-16 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[560px] text-left text-sm">
          <caption className="sr-only">Comparação dos planos</caption>
          <thead className="bg-surface">
            <tr>
              <th scope="col" className="p-4 font-semibold">Compare</th>
              {plans.map((p) => (
                <th key={p.id} scope="col" className="p-4 font-semibold">{p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="border-t border-border">
                <th scope="row" className="p-4 font-medium text-muted">{label}</th>
                {plans.map((p) => (
                  <td key={p.id} className="p-4">{value(p)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function PlanosPage() {
  return (
    <Container className="py-16">
      <SectionTitle eyebrow="Planos" title="Compare e escolha" subtitle="Todos com ligações ilimitadas, bônus mensal e sem fidelidade." />
      <div className="mt-10">
        <Suspense fallback={<PlanCardsSkeleton />}>
          <Comparison />
        </Suspense>
      </div>
    </Container>
  );
}

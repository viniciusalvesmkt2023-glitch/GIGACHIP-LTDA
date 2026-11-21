import { Suspense } from "react";
import { PlanCard, PlanGridSkeleton } from "@/components/plan-card";
import { ButtonLink, Container, SectionTitle } from "@/components/ui";
import { listActivePlans } from "@/lib/server/catalog";

const steps = [
  { n: "1", title: "Escolha o plano", text: "Compare as opções e escolha a franquia ideal para você." },
  { n: "2", title: "Cadastre-se e pague", text: "Preencha seus dados e pague a 1ª mensalidade por PIX ou cartão." },
  { n: "3", title: "Envie o ID do celular", text: "No formulário de ativação, mande o print do *#06# — o site lê os números sozinho." },
  { n: "4", title: "Assine o contrato", text: "Chega no seu e-mail pela D4Sign, com foto do documento e selfie para confirmar que é você." },
  { n: "5", title: "Linha ativada", text: "Você chama a gente no WhatsApp, nossa equipe ativa a linha e você recebe o número por e-mail." },
];

async function Plans() {
  const plans = await listActivePlans();
  const middle = Math.floor(plans.length / 2);
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {plans.map((plan, i) => (
        <PlanCard key={plan.id} plan={plan} highlight={plans.length >= 3 && i === middle} />
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <>
      <section className="bg-gradient-to-b from-brand-soft to-white">
        <Container className="grid gap-10 py-16 sm:py-24 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="inline-block rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand shadow-sm">
              Na rede Vivo · sem fidelidade
            </p>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
              Internet de sobra e ligações ilimitadas, contratando 100% online.
            </h1>
            <p className="mt-4 text-lg text-muted">
              Planos de 200GB a 400GB por mês, com eSIM ou chip físico. Sem fila, sem papelada: tudo pelo
              celular, com contrato digital e acompanhamento do pedido.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/planos">Ver planos</ButtonLink>
              <ButtonLink href="#como-funciona" variant="secondary">
                Como funciona
              </ButtonLink>
            </div>
          </div>
          <ul className="grid gap-3 text-sm sm:grid-cols-2">
            {[
              ["Sem fidelidade", "Cancele quando quiser, sem multa."],
              ["Ligações ilimitadas", "Fale à vontade, sem contar minutos."],
              ["Bônus todo mês", "100GB extras renovados mensalmente."],
              ["eSIM ou chip", "Ative no aparelho que preferir."],
            ].map(([t, d]) => (
              <li key={t} className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                <p className="font-semibold">{t}</p>
                <p className="mt-1 text-muted">{d}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section id="planos" className="py-16">
        <Container>
          <SectionTitle eyebrow="Planos" title="Escolha o seu plano" subtitle="Mensalidade fixa, sem fidelidade." />
          <div className="mt-10">
            <Suspense fallback={<PlanGridSkeleton />}>
              <Plans />
            </Suspense>
          </div>
        </Container>
      </section>

      <section id="como-funciona" className="bg-surface py-16">
        <Container>
          <SectionTitle eyebrow="Como funciona" title="Da escolha à linha ativa" />
          <ol className="mt-10 grid gap-4 md:grid-cols-5">
            {steps.map((s) => (
              <li key={s.n} className="rounded-2xl border border-border bg-white p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                  {s.n}
                </span>
                <p className="mt-3 font-semibold">{s.title}</p>
                <p className="mt-1 text-sm text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>
    </>
  );
}

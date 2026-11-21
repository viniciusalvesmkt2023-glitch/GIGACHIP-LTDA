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
      {/* Topo escuro com o brilho da marca */}
      <section className="glow-hero text-white">
        <Container className="grid gap-10 py-14 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
              <span className="h-2 w-2 rounded-full bg-neon-green shadow-[0_0_8px_var(--neon-green)]" />
              Na rede Vivo · sem fidelidade
            </p>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Internet de sobra e <span className="text-neon">ligações ilimitadas</span>, contratando 100% online.
            </h1>
            <p className="mt-5 text-lg text-white/70">
              Planos de 200GB a 400GB por mês, com eSIM ou chip físico. Sem fila e sem papelada: tudo pelo celular.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/planos" variant="neon" className="px-6 py-3.5 text-base">Ver planos</ButtonLink>
              <ButtonLink href="#como-funciona" variant="ghostDark" className="px-6 py-3.5 text-base">Como funciona</ButtonLink>
            </div>
            <ul className="mt-10 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {[
                ["Sem fidelidade", "Cancele sem multa"],
                ["Ligações ilimitadas", "Fale à vontade"],
                ["+100GB todo mês", "Bônus renovado"],
                ["eSIM ou chip", "Você escolhe"],
              ].map(([t, d]) => (
                <li key={t} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="font-semibold text-white">{t}</p>
                  <p className="mt-0.5 text-white/55">{d}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative mx-auto hidden w-full max-w-sm lg:block">
            <div className="absolute inset-6 rounded-full bg-neon opacity-30 blur-3xl" aria-hidden />
            {/* eslint-disable-next-line @next/next/no-img-element -- logo estática */}
            <img src="/brand/gigachip-logo-512.png" alt="Gigachip — voz, dados e TV" className="relative w-full rounded-full" />
          </div>
        </Container>
      </section>

      <section id="planos" className="py-16 sm:py-20">
        <Container>
          <SectionTitle eyebrow="Planos" title="Escolha o seu plano" subtitle="Mensalidade fixa, ligações ilimitadas e sem fidelidade." />
          <div className="mt-12">
            <Suspense fallback={<PlanGridSkeleton />}>
              <Plans />
            </Suspense>
          </div>
        </Container>
      </section>

      <section id="como-funciona" className="bg-surface py-16 sm:py-20">
        <Container>
          <SectionTitle eyebrow="Como funciona" title="Da compra à linha ativa" subtitle="Tudo pelo celular, em poucos minutos." />
          <ol className="mt-12 grid gap-4 md:grid-cols-5">
            {steps.map((s) => (
              <li key={s.n} className="relative rounded-2xl border border-border bg-white p-5 shadow-sm">
                <span className="font-display flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-lg font-bold">
                  <span className="text-neon">{s.n}</span>
                </span>
                <p className="mt-4 font-semibold">{s.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* Chamada final */}
      <section className="py-16 sm:py-20">
        <Container>
          <div className="glow-hero relative overflow-hidden rounded-3xl px-6 py-12 text-center text-white sm:px-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Pronto para ter <span className="text-neon">internet de sobra</span>?</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/70">Escolha o plano, pague por PIX ou cartão e acompanhe tudo pelo celular.</p>
            <ButtonLink href="/planos" variant="neon" className="mt-8 px-8 py-4 text-base">Ver planos</ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}

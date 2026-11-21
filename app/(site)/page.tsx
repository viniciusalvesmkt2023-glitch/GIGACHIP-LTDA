import Link from "next/link";
import { Suspense } from "react";
import { IconArrowRight, IconCheck } from "@/components/icons";
import { PhoneMock } from "@/components/phone-mock";
import { PlanCard, PlanGridSkeleton } from "@/components/plan-card";
import { ButtonLink, Container } from "@/components/ui";
import { FAQ } from "@/lib/faq";
import { listActivePlans } from "@/lib/server/catalog";

const steps = [
  { title: "Escolha o plano", text: "200GB, 300GB ou 400GB por mês." },
  { title: "Cadastre-se e pague", text: "1ª mensalidade por PIX ou cartão." },
  { title: "Envie o ID do celular", text: "Um print do *#06# e pronto." },
  { title: "Assine o contrato", text: "Pelo e-mail, com documento e selfie." },
  { title: "Linha ativada", text: "Você recebe o número por e-mail." },
];

const stats = [
  { value: "até 400GB", label: "de internet por mês" },
  { value: "Ilimitadas", label: "ligações para falar à vontade" },
  { value: "Zero", label: "fidelidade ou multa para cancelar" },
  { value: "100%", label: "online, direto pelo celular" },
];

async function Plans() {
  const plans = await listActivePlans();
  const middle = Math.floor(plans.length / 2);
  return (
    <div className="grid items-stretch gap-5 md:grid-cols-3">
      {plans.map((plan, i) => (
        <PlanCard key={plan.id} plan={plan} highlight={plans.length >= 3 && i === middle} />
      ))}
    </div>
  );
}

function Heading({ eyebrow, children, sub }: { eyebrow: string; children: React.ReactNode; sub?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold text-ink/50">{eyebrow}</p>
      <h2 className="font-heading mt-2 text-4xl font-extrabold text-ink sm:text-5xl">{children}</h2>
      {sub && <p className="mt-4 text-lg text-ink/60">{sub}</p>}
    </div>
  );
}

export default function Home() {
  return (
    <>
      {/* TOPO */}
      <section className="overflow-hidden">
        <Container className="grid gap-14 pb-20 pt-14 sm:pt-20 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:pb-28">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-ink/10 px-3 py-1.5 text-xs font-semibold text-ink/70">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1bb36a]" /> Na rede Vivo · sem fidelidade
            </p>
            <h1 className="font-heading mt-6 text-5xl font-extrabold leading-[1.02] text-ink sm:text-7xl">
              Internet que dura <span className="mark whitespace-nowrap">o mês inteiro</span>.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink/60 sm:text-xl">
              Planos de 200GB a 400GB com ligações ilimitadas. Contrate pelo celular em poucos minutos, sem fidelidade e sem papelada.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
              <ButtonLink href="#planos" variant="ink" className="px-7 py-4 text-base">
                Ver planos <IconArrowRight className="h-4 w-4" />
              </ButtonLink>
              <Link href="#como-funciona" className="text-base font-semibold text-ink underline decoration-ink/25 underline-offset-[6px] hover:decoration-ink">
                Como funciona
              </Link>
            </div>
            <p className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink/60">
              {["PIX ou cartão", "eSIM ou chip físico", "Contrato digital"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5"><IconCheck className="h-4 w-4 text-ink" />{t}</span>
              ))}
            </p>
          </div>
          <PhoneMock />
        </Container>
      </section>

      {/* NÚMEROS */}
      <section className="border-y border-ink/[0.06] bg-surface">
        <Container className="grid grid-cols-2 divide-ink/[0.08] py-2 lg:grid-cols-4 lg:divide-x">
          {stats.map((s) => (
            <div key={s.value} className="px-2 py-8 lg:px-8">
              <p className="font-heading text-3xl font-extrabold text-ink sm:text-4xl">{s.value}</p>
              <p className="mt-1 text-sm text-ink/55">{s.label}</p>
            </div>
          ))}
        </Container>
      </section>

      {/* PLANOS */}
      <section id="planos" className="scroll-mt-20 py-20 sm:py-28">
        <Container>
          <Heading eyebrow="Planos" sub="Todos com ligações ilimitadas, 100GB de bônus todo mês e sem fidelidade.">
            Escolha quanto de internet você quer
          </Heading>
          <div className="mt-12">
            <Suspense fallback={<PlanGridSkeleton />}>
              <Plans />
            </Suspense>
          </div>
        </Container>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="scroll-mt-20 bg-surface py-20 sm:py-28">
        <Container>
          <Heading eyebrow="Como funciona" sub="Da compra à linha ativa, sem sair de casa.">
            Cinco passos, <span className="mark">tudo pelo celular</span>
          </Heading>
          <ol className="relative mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
            <span className="absolute left-0 right-0 top-5 hidden h-px bg-ink/10 lg:block" aria-hidden />
            {steps.map((s, i) => (
              <li key={s.title} className="relative">
                <span className="relative flex h-10 w-10 items-center justify-center rounded-full border border-ink/15 bg-white font-heading text-sm font-bold text-ink">
                  {i + 1}
                </span>
                <h3 className="font-heading mt-5 text-lg font-bold text-ink">{s.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink/60">{s.text}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* DÚVIDAS */}
      <section id="duvidas" className="scroll-mt-20 py-20 sm:py-28">
        <Container className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <Heading eyebrow="Dúvidas">Perguntas frequentes</Heading>
            <Link href="/perguntas-frequentes" className="mt-6 inline-flex items-center gap-2 font-semibold text-ink underline decoration-ink/25 underline-offset-[6px] hover:decoration-ink">
              Ver todas as perguntas <IconArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="divide-y divide-ink/[0.08] border-y border-ink/[0.08]">
            {FAQ.slice(0, 6).map((item) => (
              <details key={item.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-heading text-lg font-bold text-ink">
                  {item.q}
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-ink/15 text-lg transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 max-w-2xl leading-relaxed text-ink/65">{item.a}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      {/* CHAMADA FINAL */}
      <section className="pb-20 sm:pb-28">
        <Container>
          <div className="rounded-[32px] bg-ink px-7 py-14 text-white sm:px-14 sm:py-20">
            <h2 className="font-heading max-w-3xl text-4xl font-extrabold leading-tight sm:text-6xl">
              Chega de ficar sem internet no <span className="bg-neon-lime px-2 text-ink">fim do mês</span>.
            </h2>
            <p className="mt-5 max-w-xl text-lg text-white/60">Escolha o plano, pague por PIX ou cartão e acompanhe tudo pelo celular.</p>
            <ButtonLink href="#planos" variant="lime" className="mt-9 px-8 py-4 text-base">
              Escolher meu plano <IconArrowRight className="h-4 w-4" />
            </ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}

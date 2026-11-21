import { Suspense } from "react";
import { PlanCard, PlanGridSkeleton } from "@/components/plan-card";
import type { ReactNode } from "react";
import { ChipIllustration } from "@/components/chip-illustration";
import {
  IconArrowRight, IconCard, IconCheck, IconPhone, IconScan, IconShield, IconSignature, IconSmartphone, IconSparkles, IconWhatsapp,
} from "@/components/icons";
import { ButtonLink, Container, SectionTitle } from "@/components/ui";
import { listActivePlans } from "@/lib/server/catalog";

const steps: { title: string; text: string; icon: ReactNode }[] = [
  { title: "Escolha seu plano", text: "Compare as franquias e escolha a ideal para a sua rotina.", icon: <IconSmartphone className="h-6 w-6" /> },
  { title: "Cadastre-se e pague", text: "Preencha seus dados e pague a 1ª mensalidade por PIX ou cartão.", icon: <IconCard className="h-6 w-6" /> },
  { title: "Envie o ID do celular", text: "Mande o print do *#06# — o site lê os números sozinho.", icon: <IconScan className="h-6 w-6" /> },
  { title: "Assine o contrato", text: "Chega no seu e-mail, com foto do documento e selfie para sua segurança.", icon: <IconSignature className="h-6 w-6" /> },
  { title: "Linha ativada", text: "Chame a gente no WhatsApp: ativamos e você recebe o número por e-mail.", icon: <IconSparkles className="h-6 w-6" /> },
];

const marquee = ["Sem fidelidade", "Ligações ilimitadas", "+100GB todo mês", "eSIM ou chip", "Rede Vivo", "Contratação 100% online"];

async function Plans() {
  const plans = await listActivePlans();
  const middle = Math.floor(plans.length / 2);
  return (
    <div className="grid items-stretch gap-6 md:grid-cols-3">
      {plans.map((plan, i) => (
        <PlanCard key={plan.id} plan={plan} highlight={plans.length >= 3 && i === middle} />
      ))}
    </div>
  );
}

function Benefit({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-[24px] bg-white p-7 shadow-[0_1px_2px_rgb(4_7_13/0.04),0_16px_36px_-20px_rgb(4_7_13/0.18)] ring-1 ring-border">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand ring-1 ring-brand/10">{icon}</span>
      <h3 className="font-heading mt-5 text-xl font-bold text-ink">{title}</h3>
      <p className="mt-2 leading-relaxed text-muted">{text}</p>
    </div>
  );
}

export default function Home() {
  return (
    <>
      {/* TOPO escuro (passa por baixo do menu flutuante) */}
      <section className="glow-hero relative -mt-24 overflow-hidden pt-24 text-white">
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" aria-hidden />
        <Container className="relative grid gap-6 pb-16 pt-10 sm:pb-24 sm:pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <p className="flex items-center gap-3 border-l-2 border-neon-green pl-3 text-white/75">
              Cansou de ficar sem internet antes do mês acabar?
            </p>
            <h1 className="font-heading mt-6 text-5xl font-extrabold leading-[0.98] sm:text-6xl lg:text-7xl">
              Muito mais internet, ligações ilimitadas e <span className="text-neon">sem fidelidade.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/65">
              Planos de 200GB a 400GB por mês na rede Vivo, com eSIM ou chip físico. Contrate pelo celular, sem fila e sem papelada.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="#planos" variant="neon" className="px-7 py-4 text-base">
                Ver planos <IconArrowRight className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink href="#como-funciona" variant="ghostDark" className="px-7 py-4 text-base">Como funciona</ButtonLink>
            </div>
            <p className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60">
              {["Mensalidade fixa", "Ativação rápida", "Contrato digital"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5"><IconCheck className="h-4 w-4 text-neon-green" />{t}</span>
              ))}
            </p>
          </div>
          <ChipIllustration className="mx-auto max-w-[300px] sm:max-w-[420px] lg:max-w-none" />
        </Container>
      </section>

      {/* FAIXA rolando */}
      <div className="overflow-hidden bg-neon py-4 text-ink">
        <div className="marquee flex w-max gap-10 whitespace-nowrap">
          {[...marquee, ...marquee].map((t, i) => (
            <span key={i} className="flex items-center gap-10 text-sm font-extrabold uppercase tracking-[0.18em]">
              {t} <span aria-hidden className="h-1.5 w-1.5 rotate-45 bg-ink" />
            </span>
          ))}
        </div>
      </div>

      {/* PLANOS */}
      <section id="planos" className="bg-grid-light scroll-mt-24 py-20 sm:py-28">
        <Container>
          <SectionTitle align="left" eyebrow="Planos" title="Escolha o plano ideal para você" subtitle="Todos com ligações ilimitadas, bônus de 100GB todo mês e sem fidelidade." />
          <div className="mt-12">
            <Suspense fallback={<PlanGridSkeleton />}>
              <Plans />
            </Suspense>
          </div>
        </Container>
      </section>

      {/* VANTAGENS (mosaico) */}
      <section id="vantagens" className="scroll-mt-24 bg-surface py-20 sm:py-28">
        <Container>
          <SectionTitle align="left" eyebrow="Por que a Gigachip" title="Uma escolha que faz sentido" />
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            <div className="glow-hero relative flex min-h-[22rem] flex-col justify-between overflow-hidden rounded-[24px] p-8 text-white lg:row-span-2">
              <div>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-neon-green"><IconSparkles className="h-6 w-6" /></span>
                <h3 className="font-heading mt-8 text-3xl font-extrabold">Internet de sobra para a sua rotina</h3>
                <p className="mt-3 leading-relaxed text-white/65">Até 400GB por mês para trabalhar, conversar, assistir e navegar sem ficar contando os gigas.</p>
              </div>
              <div className="mt-10 flex items-end gap-3" aria-hidden>
                {[28, 44, 60, 80, 104].map((h) => (
                  <span key={h} className="w-full rounded-lg bg-neon" style={{ height: h, opacity: 0.35 + h / 180 }} />
                ))}
              </div>
            </div>
            <Benefit icon={<IconShield className="h-6 w-6" />} title="Liberdade sem fidelidade" text="Sem contrato de permanência e sem multa para cancelar." />
            <Benefit icon={<IconPhone className="h-6 w-6" />} title="Ligações ilimitadas" text="Fale à vontade, sem ficar contando os minutos." />
            <Benefit icon={<IconSmartphone className="h-6 w-6" />} title="eSIM ou chip físico" text="Você escolhe, conforme a compatibilidade do seu aparelho." />
            <Benefit icon={<IconSignature className="h-6 w-6" />} title="Contratação segura" text="Contrato digital com validação de identidade. Tudo pelo celular." />
          </div>
        </Container>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="bg-grid-light scroll-mt-24 py-20 sm:py-28">
        <Container>
          <SectionTitle eyebrow="Passo a passo" title="Como funciona" subtitle="Da compra à linha ativa, tudo de forma simples e sem complicação." />
          <ol className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((s, i) => (
              <li key={s.title} className="relative rounded-[24px] bg-white p-6 shadow-[0_1px_2px_rgb(4_7_13/0.04),0_16px_36px_-20px_rgb(4_7_13/0.18)] ring-1 ring-border">
                <div className="flex items-start justify-between">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink text-neon-green shadow-[0_8px_20px_-8px_rgb(1_186_254/0.7)]">{s.icon}</span>
                  <span className="font-heading text-5xl font-extrabold text-ink/[0.07]">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <p className="eyebrow mt-6 text-brand">Etapa {String(i + 1).padStart(2, "0")}</p>
                <h3 className="font-heading mt-2 text-xl font-bold text-ink">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* CHAMADA FINAL */}
      <section className="bg-neon">
        <Container className="py-20 text-center text-ink sm:py-24">
          <h2 className="font-heading mx-auto max-w-3xl text-4xl font-extrabold sm:text-6xl">Pronto para ter mais internet e mais liberdade?</h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-ink/70">Escolha o plano, pague por PIX ou cartão e acompanhe tudo pelo celular.</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <ButtonLink href="#planos" variant="ink" className="px-8 py-4 text-base">
              Escolher meu plano <IconArrowRight className="h-4 w-4" />
            </ButtonLink>
          </div>
          <p className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-ink/70">
            <IconWhatsapp className="h-4 w-4" /> Dúvidas? Fale com a gente no WhatsApp.
          </p>
        </Container>
      </section>
    </>
  );
}

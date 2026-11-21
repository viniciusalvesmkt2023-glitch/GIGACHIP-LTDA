import Link from "next/link";
import { Suspense } from "react";
import {
  IconArrowRight, IconArrowUpRight, IconCard, IconChevronDown, IconSignal, IconSignature, IconSmartphone, IconSparkle,
} from "@/components/icons";
import { PhoneHero } from "@/components/phone-hero";
import { PlanCard, PlanGridSkeleton } from "@/components/plan-card";
import { FAQ } from "@/lib/faq";
import { listActivePlans } from "@/lib/server/catalog";

/** Página inicial — layout do Lovable (screenshot-perfect), com fundo branco e chamada final azul. */

const steps = [
  { title: "Escolha seu plano", text: "200GB, 300GB ou 400GB. Escolha o que combina com você." },
  { title: "Cadastre-se e pague", text: "Preencha seus dados e pague com PIX ou cartão." },
  { title: "Envie o ID do celular", text: "Digite *#06# e envie um print dos dados do aparelho." },
  { title: "Assine o contrato", text: "Tudo pelo e-mail, com seu documento e uma selfie." },
  { title: "Pronto. Linha ativada!", text: "Você recebe seu número por e-mail. É só aproveitar." },
];

const ticker = ["Internet pra viver sem limites", "Sem fidelidade", "Na rede Vivo", "100% online", "Muito mais gigas"];

async function Plans() {
  const plans = await listActivePlans();
  const middle = Math.floor(plans.length / 2);
  return (
    <div className="plan-grid">
      {plans.map((plan, i) => (
        <PlanCard key={plan.id} plan={plan} highlight={plans.length >= 3 && i === middle} />
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <>
      {/* TOPO (branco) */}
      <section className="hero-section">
        <div className="container-site hero-content">
          <div>
            <div className="hero-eyebrow">
              <span className="status-dot" /> Na rede Vivo <span className="text-[var(--s-muted)]">·</span> sem fidelidade
              <IconSignal className="h-3 w-3 text-[var(--s-brand)]" />
            </div>
            <h1 className="hero-title">
              Internet que dura
              <br /> <span className="highlight">o mês inteiro.</span>
            </h1>
            <p className="hero-description">
              Planos de 200GB a 400GB com ligações ilimitadas. Contrate pelo celular em poucos minutos, sem fidelidade e sem papelada.
            </p>
            <div className="hero-actions">
              <Link href="#planos" className="btn btn-primary">Ver planos <IconArrowRight /></Link>
              <Link href="#como-funciona" className="btn btn-dark-outline">Como funciona <IconArrowUpRight /></Link>
            </div>
            <div className="hero-seals">
              <span><IconCard /> PIX ou cartão</span>
              <span><IconSmartphone /> eSIM ou chip físico</span>
              <span><IconSignature /> Contrato digital</span>
            </div>
          </div>
          <PhoneHero />
        </div>
      </section>

      {/* FAIXA rolando */}
      <div className="ticker" aria-label="Muito mais internet, sem fidelidade, na rede Vivo">
        <div className="ticker-track" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i}>
              {ticker.map((t) => (
                <span key={t}>{t.toUpperCase()} <IconSparkle /></span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* NÚMEROS */}
      <div className="container-site stats">
        <div className="stat"><strong>Até 400GB</strong><span>de internet por mês</span></div>
        <div className="stat"><strong>Ilimitadas</strong><span>ligações para falar à vontade</span></div>
        <div className="stat"><strong>Zero fidelidade</strong><span>sem amarras. Sem multa.</span></div>
        <div className="stat"><strong>100% online</strong><span>do seu jeito, pelo celular</span></div>
      </div>

      {/* PLANOS */}
      <section id="planos" className="section scroll-mt-24">
        <div className="container-site">
          <div className="text-center">
            <p className="section-eyebrow">Seu mês pede mais gigas</p>
            <h2 className="section-title">Um plano pra sua vida.<br />Não o contrário.</h2>
            <p className="section-description">Escolha sua internet. A liberdade vem em todos os planos.</p>
          </div>
          <Suspense fallback={<PlanGridSkeleton />}>
            <Plans />
          </Suspense>
          <p className="mt-7 text-center text-xs text-[var(--s-muted)]">Todos os planos na rede Vivo. Bônus de 100GB renovado todo mês.</p>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="section section-soft scroll-mt-24">
        <div className="container-site">
          <p className="section-eyebrow">Do seu celular, sem complicação</p>
          <h2 className="section-title">Poucos passos.<br />Muitos gigas.</h2>
          <p className="section-description">Da escolha à ativação, tudo acontece online.</p>
          <div className="steps-grid">
            {steps.map((s, i) => (
              <div className="step" key={s.title}>
                <span className="step-number">0{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DÚVIDAS */}
      <section id="duvidas" className="section scroll-mt-24">
        <div className="container-site faq-grid">
          <div>
            <p className="section-eyebrow">Tudo às claras</p>
            <h2 className="section-title">Ficou com<br />alguma dúvida?</h2>
            <p className="section-description">Sem letras miúdas. Veja o que você precisa saber antes de contratar.</p>
            <Link href="/perguntas-frequentes" className="link-arrow">Todas as perguntas <IconArrowUpRight /></Link>
          </div>
          <div>
            {FAQ.slice(0, 6).map((item) => (
              <details key={item.q} className="faq-item">
                <summary>{item.q}<IconChevronDown /></summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CHAMADA FINAL (azul) */}
      <section className="final-section">
        <div className="container-site">
          <p className="section-eyebrow">Mais internet. Menos preocupação.</p>
          <h2 className="section-title">Chega de ficar sem internet<br className="hidden sm:block" /> no fim do mês.</h2>
          <p className="final-sub">Escolha seu plano e contrate pelo celular em poucos minutos.</p>
          <Link href="#planos" className="btn btn-white mt-8">Escolher meu plano <IconArrowRight /></Link>
        </div>
      </section>
    </>
  );
}

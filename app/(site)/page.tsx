import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, BadgeCheck, Tag, Unlock } from "lucide-react";
import { BarraBeneficios } from "@/components/site/beneficios";
import { DesfoqueRodape } from "@/components/site/desfoque";
import { Destaques } from "@/components/site/destaques";
import { FaqContato, FaqList } from "@/components/site/faq";
import { FinalCall } from "@/components/site/final-call";
import { SecaoPassos } from "@/components/site/passos";
import { PhoneHero } from "@/components/site/phone-hero";
import { PlanCards, PlanCardsSkeleton } from "@/components/site/plan-cards";
import { whatsappLink } from "@/components/whatsapp";
import { formatBRL } from "@/lib/domain/money";
import { listActivePlans } from "@/lib/server/catalog";

/**
 * Página inicial — desenhada no Lovable (projeto screenshot-perfect) e aprovada pelos sócios.
 * Planos e preços vêm do cadastro; o resto é texto fixo.
 */

async function Planos() {
  const plans = await listActivePlans();
  return <PlanCards plans={plans} />;
}

async function APartirDe() {
  const plans = await listActivePlans();
  const menor = plans.length ? Math.min(...plans.map((p) => p.monthlyPriceCents)) : null;
  if (menor === null) return null;
  return (
    <span>
      <Tag size={14} /> A partir de <strong>{formatBRL(menor)}/mês</strong>
    </span>
  );
}

export default function Home() {
  const whatsapp = whatsappLink("Olá! Quero tirar uma dúvida sobre os planos da Gigachip.");
  return (
    <>
      <section className="hero-section">
        <div className="container-site hero-content">
          <div className="hero-copy">
            <div className="hero-eyebrow">
              <span className="status-dot" aria-hidden="true" />
              <strong>+800 linhas vendidas</strong> na rede Vivo
            </div>
            <h1 className="hero-title">
              Use sem medo.
              <br /> <span className="highlight">Sua internet não acaba no meio do mês.</span>
            </h1>
            <p className="hero-description">
              Linha Vivo com até 400GB, ligações ilimitadas e zero fidelidade. Sem consulta ao SPC/Serasa e sem sair de
              casa: você contrata pelo celular em poucos minutos.
            </p>
            <div className="hero-actions">
              <Link href="/#planos" className="gc-hero-cta">
                <span className="gc-hero-cta-text">
                  Escolher meu plano
                  <span className="gc-hero-cta-arrow" aria-hidden="true">
                    <ArrowRight size={20} />
                  </span>
                </span>
              </Link>
            </div>
            <div className="hero-seals">
              <span>
                <Unlock size={14} /> Sem fidelidade
              </span>
              <span>
                <BadgeCheck size={14} /> Sem consulta SPC/Serasa
              </span>
              <Suspense fallback={null}>
                <APartirDe />
              </Suspense>
            </div>
          </div>
          <PhoneHero />
        </div>
      </section>

      <BarraBeneficios />
      <SecaoPassos />

      <section id="planos" className="section gc-plans-section t-light scroll-mt-24">
        <div className="container-site">
          <div className="text-center">
            <p className="section-eyebrow">ESCOLHA SEU PLANO</p>
            <h2 className="section-title">
              Mais internet por menos.
              <br />
              <span className="gc-text-gradient">Sem fidelidade.</span>
            </h2>
            <p className="section-description">
              Todos com ligações ilimitadas, 100GB de bônus todo mês e linha na rede Vivo.
            </p>
          </div>
          <Suspense fallback={<PlanCardsSkeleton />}>
            <Planos />
          </Suspense>
        </div>
      </section>

      <Destaques />

      <section id="duvidas" className="section gc-faq-section scroll-mt-24">
        <div className="container-site faq-grid">
          <div className="gc-faq-side">
            <p className="section-eyebrow">TUDO ÀS CLARAS</p>
            <h2 className="section-title">
              Ficou com
              <br />
              <span className="gc-text-gradient">alguma dúvida?</span>
            </h2>
            <p className="section-description">Sem letras miúdas. Veja o que você precisa saber antes de contratar.</p>
            <Link href="/perguntas-frequentes" className="gc-faq-all">
              Ver todas as perguntas →
            </Link>
            <FaqContato whatsapp={whatsapp} />
          </div>
          <FaqList />
        </div>
      </section>

      <FinalCall />
      <DesfoqueRodape />
    </>
  );
}

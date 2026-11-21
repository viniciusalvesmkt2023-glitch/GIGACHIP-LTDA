import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/site";
import { IconWhatsapp } from "./icons";
import { Suspense } from "react";
import { formatBRL } from "@/lib/domain/money";
import { listActivePlans } from "@/lib/server/catalog";
import { HeaderBar } from "./header-bar";
import { Container, Logo } from "./ui";
import { whatsappLink } from "./whatsapp";

async function HeaderWithPlans() {
  const plans = await listActivePlans();
  return (
    <HeaderBar
      plans={plans.map((p) => ({ slug: p.slug, name: p.name, gb: p.dataTotalGb, price: formatBRL(p.monthlyPriceCents) }))}
    />
  );
}

/** Menu do topo (estilo do site EngajaEu). Os planos do menu suspenso vêm do cadastro. */
export function SiteHeader() {
  return (
    <Suspense fallback={<HeaderBar plans={[]} />}>
      <HeaderWithPlans />
    </Suspense>
  );
}

/** Botão do WhatsApp no canto (só aparece quando o número estiver cadastrado). */
export function WhatsappFloat() {
  const wa = whatsappLink("Olá! Quero tirar uma dúvida sobre os planos da Gigachip.");
  if (!wa) return null;
  return (
    <a
      href={wa}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex h-13 w-13 items-center justify-center rounded-full bg-[#25d366] p-3.5 text-white shadow-lg transition hover:scale-105"
    >
      <IconWhatsapp className="h-6 w-6" />
    </a>
  );
}

export function SiteFooter() {
  const wa = whatsappLink("Olá! Quero falar com a Gigachip.");
  return (
    <footer className="border-t border-ink/[0.06] bg-surface text-sm text-ink/60">
      <Container className="grid gap-10 py-14 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo size={34} />
          <p className="mt-4 max-w-xs leading-relaxed">
            Empresa independente, parceira comercial da operadora Vivo. Este não é o site oficial da Vivo.
          </p>
        </div>
        <div className="flex flex-col gap-2.5">
          <p className="font-semibold text-ink">Gigachip</p>
          <Link href="/#planos" className="transition hover:text-ink">Planos</Link>
          <Link href="/perguntas-frequentes" className="transition hover:text-ink">Perguntas frequentes</Link>
          <Link href="/termos" className="transition hover:text-ink">Termos de uso</Link>
          <Link href="/privacidade" className="transition hover:text-ink">Privacidade</Link>
        </div>
        <div className="flex flex-col gap-2.5">
          <p className="font-semibold text-ink">Atendimento</p>
          <a href={`mailto:${CONTACT_EMAIL}`} className="transition hover:text-ink">{CONTACT_EMAIL}</a>
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="transition hover:text-ink">WhatsApp</a>}
          <p>CNPJ 51.968.628/0001-16</p>
        </div>
      </Container>
      <Container className="border-t border-ink/[0.06] py-5 text-xs text-ink/40">
        © Gigachip Ltda. Preços e benefícios conforme condições vigentes. Vivo é marca registrada de seus respectivos titulares.
      </Container>
    </footer>
  );
}

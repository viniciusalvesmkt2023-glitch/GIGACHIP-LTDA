import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/site";
import { IconWhatsapp } from "./icons";
import { Suspense } from "react";
import { formatBRL } from "@/lib/domain/money";
import { listActivePlans } from "@/lib/server/catalog";
import { HeaderBar } from "./header-bar";
import { Logo } from "./ui";
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
    <footer className="border-t border-[var(--s-border)] bg-white">
      <div className="container-site footer-grid">
        <div>
          <Logo size={44} />
          <p className="mt-4 max-w-sm">Empresa independente, parceira comercial da operadora Vivo. Este não é o site oficial da Vivo.</p>
        </div>
        <div>
          <h3>Explore</h3>
          <div className="grid gap-1">
            <Link href="/#planos">Planos</Link>
            <Link href="/perguntas-frequentes">Perguntas frequentes</Link>
            <Link href="/termos">Termos de uso</Link>
            <Link href="/privacidade">Política de privacidade</Link>
          </div>
        </div>
        <div>
          <h3>Fale com a Gigachip</h3>
          <p><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
          {wa && <p><a href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a></p>}
          <p className="mt-2">CNPJ 51.968.628/0001-16</p>
        </div>
      </div>
      <div className="container-site border-t border-[var(--s-border)] py-5 text-xs text-[var(--s-muted)]">
        © Gigachip Ltda. Preços e benefícios conforme condições vigentes. Vivo é marca registrada de seus respectivos titulares.
      </div>
    </footer>
  );
}

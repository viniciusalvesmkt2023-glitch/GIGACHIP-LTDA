import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/site";
import { Container, Logo, buttonStyles } from "./ui";
import { whatsappLink } from "./whatsapp";

const nav = [
  { href: "/planos", label: "Planos" },
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/perguntas-frequentes", label: "Dúvidas" },
];

export function SiteHeader() {
  const wa = whatsappLink("Olá! Quero tirar uma dúvida sobre os planos.");
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-ink/95 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="Gigachip — início">
          <Logo dark size={34} />
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-white/70 sm:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>
        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" className={`${buttonStyles.whatsapp} px-4 py-2`}>
            WhatsApp
          </a>
        ) : (
          <Link href="/planos" className={`${buttonStyles.neon} px-4 py-2`}>
            Ver planos
          </Link>
        )}
      </Container>
      {/* Faixa com o degradê da marca */}
      <div className="h-[3px] bg-neon" />
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-ink text-sm text-white/60">
      <div className="h-[3px] bg-neon" />
      <Container className="grid gap-8 py-12 sm:grid-cols-3">
        <div>
          <Logo dark size={40} />
          <p className="mt-4">Gigachip Ltda. · CNPJ 51.968.628/0001-16</p>
          <p className="mt-1">
            <a href={`mailto:${CONTACT_EMAIL}`} className="transition hover:text-white">{CONTACT_EMAIL}</a>
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Link href="/planos" className="transition hover:text-white">Planos</Link>
          <Link href="/perguntas-frequentes" className="transition hover:text-white">Perguntas frequentes</Link>
          <Link href="/termos" className="transition hover:text-white">Termos de uso</Link>
          <Link href="/privacidade" className="transition hover:text-white">Política de privacidade</Link>
        </div>
        <p className="leading-relaxed">
          A Gigachip é uma empresa independente, parceira comercial da operadora Vivo. Este não é o site
          oficial da Vivo. Vivo é marca registrada de seus respectivos titulares.
        </p>
      </Container>
    </footer>
  );
}

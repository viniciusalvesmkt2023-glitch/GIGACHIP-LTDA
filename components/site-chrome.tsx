import Link from "next/link";
import { Container, buttonStyles } from "./ui";
import { whatsappLink } from "./whatsapp";

const nav = [
  { href: "/planos", label: "Planos" },
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/perguntas-frequentes", label: "Dúvidas" },
];

export function SiteHeader() {
  const wa = whatsappLink("Olá! Quero tirar uma dúvida sobre os planos.");
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-white/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" className="text-xl font-extrabold tracking-tight">
          giga<span className="text-brand">chip</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted sm:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" className={`${buttonStyles.whatsapp} px-4 py-2`}>
            WhatsApp
          </a>
        ) : (
          <Link href="/planos" className={`${buttonStyles.primary} px-4 py-2`}>
            Ver planos
          </Link>
        )}
      </Container>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-surface">
      <Container className="grid gap-8 py-10 text-sm text-muted sm:grid-cols-3">
        <div>
          <p className="text-base font-extrabold text-foreground">
            giga<span className="text-brand">chip</span>
          </p>
          <p className="mt-2">Gigachip Ltda. · CNPJ 51.968.628/0001-16</p>
        </div>
        <div className="flex flex-col gap-2">
          <Link href="/planos" className="hover:text-foreground">Planos</Link>
          <Link href="/perguntas-frequentes" className="hover:text-foreground">Perguntas frequentes</Link>
          <Link href="/termos" className="hover:text-foreground">Termos de uso</Link>
          <Link href="/privacidade" className="hover:text-foreground">Política de privacidade</Link>
        </div>
        <p className="leading-relaxed">
          A Gigachip é uma empresa independente, parceira comercial da operadora Vivo. Este não é o site
          oficial da Vivo. Vivo é marca registrada de seus respectivos titulares.
        </p>
      </Container>
    </footer>
  );
}

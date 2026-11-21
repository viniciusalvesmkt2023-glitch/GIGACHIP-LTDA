import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/site";
import { IconArrowRight, IconWhatsapp } from "./icons";
import { Container, Logo, buttonStyles } from "./ui";
import { whatsappLink } from "./whatsapp";

const nav = [
  { href: "/#planos", label: "Planos" },
  { href: "/#vantagens", label: "Vantagens" },
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/perguntas-frequentes", label: "Dúvidas" },
];

/** Menu em "pílula" flutuante (fica por cima do topo escuro e acompanha a rolagem). */
export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-3 z-40 px-3">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 rounded-full border border-white/10 bg-ink/80 pl-3 pr-2 shadow-[0_10px_40px_-10px_rgb(0_0_0/0.6)] backdrop-blur-xl">
        <Link href="/" aria-label="Gigachip — início" className="shrink-0">
          <Logo dark size={30} />
        </Link>
        <nav className="hidden items-center gap-1 text-sm font-medium text-white/70 md:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-full px-4 py-2 transition hover:bg-white/10 hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>
        <Link href="/#planos" className={`${buttonStyles.neon} px-4 py-2.5`}>
          Ver planos <IconArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}

/** Botão do WhatsApp flutuando no canto (só aparece quando o número estiver cadastrado). */
export function WhatsappFloat() {
  const wa = whatsappLink("Olá! Quero tirar uma dúvida sobre os planos da Gigachip.");
  if (!wa) return null;
  return (
    <a
      href={wa}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25d366] text-white shadow-[0_10px_30px_-6px_rgb(37_211_102/0.7)] transition hover:scale-105"
    >
      <IconWhatsapp className="h-7 w-7" />
    </a>
  );
}

export function SiteFooter() {
  const wa = whatsappLink("Olá! Quero falar com a Gigachip.");
  return (
    <footer className="bg-ink text-sm text-white/55">
      <Container className="grid gap-10 py-14 sm:grid-cols-3">
        <div>
          <Logo dark size={40} />
          <p className="mt-5 max-w-xs leading-relaxed">
            Empresa independente, parceira comercial da operadora Vivo. Este não é o site oficial da Vivo.
          </p>
        </div>
        <div>
          <p className="eyebrow text-white">Navegação</p>
          <div className="mt-4 flex flex-col gap-2.5">
            <Link href="/#planos" className="transition hover:text-white">Planos</Link>
            <Link href="/#como-funciona" className="transition hover:text-white">Como funciona</Link>
            <Link href="/perguntas-frequentes" className="transition hover:text-white">Perguntas frequentes</Link>
            <Link href="/termos" className="transition hover:text-white">Termos de uso</Link>
            <Link href="/privacidade" className="transition hover:text-white">Política de privacidade</Link>
          </div>
        </div>
        <div>
          <p className="eyebrow text-white">Atendimento</p>
          <div className="mt-4 flex flex-col gap-2.5">
            <a href={`mailto:${CONTACT_EMAIL}`} className="transition hover:text-white">{CONTACT_EMAIL}</a>
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="transition hover:text-white">WhatsApp</a>}
            <p>Gigachip Ltda. · CNPJ 51.968.628/0001-16</p>
          </div>
        </div>
      </Container>
      <div className="border-t border-white/10">
        <Container className="py-5 text-center text-xs text-white/35">
          Preços e benefícios conforme condições vigentes. Vivo é marca registrada de seus respectivos titulares.
        </Container>
      </div>
    </footer>
  );
}

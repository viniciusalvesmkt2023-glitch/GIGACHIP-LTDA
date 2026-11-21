import { Suspense } from "react";
import { listActivePlans } from "@/lib/server/catalog";
import { SiteFooterBar } from "./site/footer";
import { HeaderBar } from "./site/header";
import { IconWhatsapp } from "./icons";
import { whatsappLink } from "./whatsapp";

async function HeaderWithPlans() {
  const plans = await listActivePlans();
  return <HeaderBar plans={plans.map((p) => ({ slug: p.slug, gb: p.dataTotalGb, priceCents: p.monthlyPriceCents }))} />;
}

/** Menu do topo (desenhado no Lovable). Os planos do menu suspenso vêm do cadastro. */
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
  return <SiteFooterBar whatsapp={whatsappLink("Olá! Quero falar com a Gigachip.")} />;
}

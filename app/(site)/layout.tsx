import { SiteFooter, SiteHeader, WhatsappFloat } from "@/components/site-chrome";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      {/* Espaço do menu flutuante (o topo escuro da página inicial passa por baixo dele) */}
      <main className="flex-1 pt-24">{children}</main>
      <SiteFooter />
      <WhatsappFloat />
    </>
  );
}

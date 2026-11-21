import { SiteFooter, SiteHeader, WhatsappFloat } from "@/components/site-chrome";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      {/* Espaço do menu flutuante (fixo no topo) */}
      <main className="flex-1 pt-24 md:pt-28">{children}</main>
      <SiteFooter />
      <WhatsappFloat />
    </>
  );
}

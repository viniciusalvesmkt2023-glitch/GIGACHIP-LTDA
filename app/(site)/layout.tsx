import { SiteFooter, SiteHeader, WhatsappFloat } from "@/components/site-chrome";
import "./site.css";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="gc-site flex min-h-full flex-1 flex-col">
      <SiteHeader />
      {/* Espaço do menu flutuante; o topo da página inicial sobe por baixo dele */}
      <main className="flex-1 pt-24">{children}</main>
      <SiteFooter />
      <WhatsappFloat />
    </div>
  );
}

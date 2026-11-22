import { Lock } from "lucide-react";
import { Logo } from "@/components/site/header";
import { WhatsappFloat } from "@/components/site-chrome";
import "../(site)/site.css";
import "./fluxo.css";

/**
 * Moldura das telas de contratação, pagamento, ativação e área do cliente (desenhadas no
 * Lovable): só a logo e "Ambiente seguro" no topo, sem o menu e sem o rodapé completo, para a
 * pessoa não sair no meio do caminho.
 */
export default function FluxoLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="gc-site flex min-h-full flex-1 flex-col">
      <header className="gc-simple-header">
        <div className="container-site gc-simple-header-row">
          <Logo />
          <span className="gc-simple-secure">
            <Lock size={15} /> Ambiente seguro
          </span>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="gc-simple-footer">
        <div className="container-site">© Gigachip Ltda · CNPJ 51.968.628/0001-16</div>
      </footer>
      <WhatsappFloat />
    </div>
  );
}

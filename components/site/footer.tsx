"use client";

/* eslint-disable @next/next/no-img-element -- logo pequena e estática */
import Link from "next/link";
import { ArrowUp, ArrowUpRight, LockKeyhole, Mail, MapPin, MessageCircle, ShieldCheck } from "lucide-react";
import { CONTACT_EMAIL } from "@/lib/site";

const RECLAME_AQUI = "https://www.reclameaqui.com.br/empresa/gigachip-ltda/";

/** Rodapé escuro (desenhado no Lovable): marca + Reclame Aqui, links legais, contato e avisos. */
export function SiteFooterBar({ whatsapp }: { whatsapp: string | null }) {
  return (
    <footer className="gc-footer">
      <div className="container-site gc-footer-grid">
        <div className="gc-footer-brand">
          <Link href="/" aria-label="Gigachip — início" className="brand-logo">
            <img src="/logo-g.png" alt="Gigachip" width={56} height={43} className="h-11 w-auto" />
          </Link>
          <p>Linhas na rede Vivo, sem fidelidade e 100% online. Empresa independente, parceira comercial da operadora Vivo.</p>
          <div className="gc-footer-seals">
            <a
              href={RECLAME_AQUI}
              target="_blank"
              rel="noopener noreferrer"
              className="gc-footer-ra"
              aria-label="Ver a Gigachip no Reclame Aqui (abre em nova aba)"
            >
              <span className="gc-footer-ra-icon" aria-hidden="true">
                <ShieldCheck size={20} />
              </span>
              <span>
                <small>Estamos no</small>
                <strong>
                  Reclame <em>AQUI</em>
                </strong>
              </span>
              <ArrowUpRight size={16} className="gc-footer-ra-arrow" aria-hidden="true" />
            </a>
            <span className="gc-seal" title="Pagamentos processados pelo Asaas">
              <small>Pagamentos processados por</small>
              <img src="/asaas-logo.png" alt="Asaas" width={74} height={20} />
            </span>
            <span className="gc-seal gc-seal-ssl">
              <span className="gc-seal-icon" aria-hidden="true">
                <LockKeyhole size={18} />
              </span>
              <span>
                <small>Site seguro</small>
                <strong>Certificado SSL</strong>
              </span>
            </span>
            <span className="gc-seal gc-seal-ssl">
              <span className="gc-seal-icon" aria-hidden="true">
                <ShieldCheck size={18} />
              </span>
              <span>
                <small>Compra</small>
                <strong>100% segura</strong>
              </span>
            </span>
          </div>
        </div>

        <div>
          <h3>Fale com a gente</h3>
          <ul>
            {whatsapp && (
              <li>
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="gc-footer-contact">
                  <MessageCircle size={16} /> WhatsApp
                </a>
              </li>
            )}
            <li>
              <a href={`mailto:${CONTACT_EMAIL}`} className="gc-footer-contact">
                <Mail size={16} /> {CONTACT_EMAIL}
              </a>
            </li>
            <li>
              <span className="gc-footer-contact gc-footer-address">
                <MapPin size={16} />
                <span>
                  <span className="block">Rua Santana Soares, 102 — Jardim Gonzaga</span>
                  <span className="block">Juazeiro do Norte – CE</span>
                  <span className="block">CEP 63046-530</span>
                </span>
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="container-site gc-footer-bottom">
        <p>
          © Gigachip Ltda · CNPJ 51.968.628/0001-16 · Todos os direitos reservados.
          <br />
          Este não é o site oficial da Vivo. Vivo é marca registrada de seus respectivos titulares.
        </p>
        <button type="button" className="gc-footer-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          Voltar ao topo <ArrowUp size={14} />
        </button>
      </div>
    </footer>
  );
}

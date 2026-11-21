import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** Chamada final azul com o efeito do bloco "Teste grátis" do EngajaEu 2.0. */
export function FinalCall() {
  return (
    <section className="final-section gc-dotted-block">
      <div className="gc-block-texture" aria-hidden="true">
        <span className="gc-block-grid" />
        <span className="gc-block-light" />
      </div>
      <div className="gc-sparkles" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i}>{i % 2 ? "✦" : "•"}</span>
        ))}
      </div>
      <div className="container-site relative">
        <p className="section-eyebrow">SUA LINHA NOVA ESTÁ A POUCOS MINUTOS</p>
        <h2 className="section-title">
          Chega de ficar sem internet
          <br className="hidden sm:block" /> no fim do mês.
        </h2>
        <p className="final-sub">Escolha seu plano agora: sem fidelidade, sem consulta e sem sair de casa.</p>
        <Link
          href="/#planos"
          className="btn-white mt-8 inline-flex h-13 items-center justify-center gap-2 rounded-full px-7 text-sm font-medium"
        >
          Quero minha linha agora <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}

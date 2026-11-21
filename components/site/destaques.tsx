"use client";

import { useEffect, useRef } from "react";
import { BadgeCheck, PhoneCall, Smartphone, Unlock, type LucideIcon } from "lucide-react";

/*
 * "Por que a Gigachip": 4 cartões logo abaixo dos planos, no estilo do EngajaEu 2.0
 * ("Por que dá para confiar": .landing-item + .landing-step-icon), em azul:
 * - entram subindo um de cada vez quando aparecem na tela;
 * - uma linha em degradê corre pela borda de cima uma vez;
 * - o título em degradê dá um brilho uma vez;
 * - com o mouse em cima, o cartão sobe, a borda fica azul e o ícone inclina.
 */

const DESTAQUES: { icon: LucideIcon; valor: string; texto: string }[] = [
  {
    icon: BadgeCheck,
    valor: "Linha oficial Vivo",
    texto: "Chip e plano de verdade, na rede Vivo. Sem gambiarra, sem VPN, sem app estranho.",
  },
  {
    icon: PhoneCall,
    valor: "Ligações ilimitadas",
    texto: "Fale à vontade para todo o Brasil, sem ficar contando minuto.",
  },
  {
    icon: Unlock,
    valor: "Zero fidelidade",
    texto: "Sem multa e sem letra miúda. Quer cancelar? É só pedir.",
  },
  {
    icon: Smartphone,
    valor: "100% online",
    texto: "Do pagamento à ativação, tudo pelo celular. Sem loja e sem fila.",
  },
];

export function Destaques() {
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = caixa.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.classList.add("motion-ready");
    const obs = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            obs.unobserve(e.target);
          }
        }),
      { threshold: 0.05 },
    );
    el.querySelectorAll(".gc-item").forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, []);

  return (
    <section className="gc-destaques t-dark">
      <div className="container-site">
        <div className="text-center">
          <p className="section-eyebrow">POR QUE A GIGACHIP</p>
          <h2 className="section-title">
            Internet de verdade.
            <br />
            <span className="gc-text-gradient">Sem pegadinha.</span>
          </h2>
        </div>
        <div ref={caixa} className="gc-destaques-grid">
          {DESTAQUES.map(({ icon: Icone, valor, texto }) => (
            <div key={valor} className="gc-item">
              <span className="gc-item-icon" aria-hidden="true">
                <Icone size={24} />
              </span>
              <strong className="gc-item-valor">{valor}</strong>
              <p className="gc-item-texto">{texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

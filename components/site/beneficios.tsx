"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { BadgeCheck, PhoneCall, Rocket, Signal, Unlock, Wifi } from "lucide-react";

/*
 * Barra de benefícios rolando em loop — cópia do LandingCarousel do EngajaEu 2.0
 * (src/components/landing/LandingEffects.tsx), com as cores trocadas para o azul da Gigachip.
 * Mede a largura dos selos e repete o suficiente para cobrir a tela sem emenda; pausa com o
 * mouse em cima.
 */

type Item = { icon: ReactNode; label: string };

const BENEFICIOS: Item[] = [
  { icon: <Unlock size={19} />, label: "SEM FIDELIDADE" },
  { icon: <BadgeCheck size={19} />, label: "SEM CONSULTA SPC/SERASA" },
  { icon: <Wifi size={19} />, label: "ATÉ 400GB POR MÊS" },
  { icon: <PhoneCall size={19} />, label: "LIGAÇÕES ILIMITADAS" },
  { icon: <Rocket size={19} />, label: "ATIVAÇÃO 100% ONLINE" },
  { icon: <Signal size={19} />, label: "REDE VIVO" },
];

/** Repetições necessárias para cobrir 2× o container sem emenda. */
function repeticoes(larguraCaixa: number, larguraGrupo: number) {
  if (!larguraGrupo || !larguraCaixa) return 2;
  return Math.max(2, Math.ceil((2 * larguraCaixa) / larguraGrupo) + 1);
}

function Carrossel({ items, label, speed = 60 }: { items: Item[]; label: string; speed?: number }) {
  const caixa = useRef<HTMLDivElement>(null);
  const grupo = useRef<HTMLDivElement>(null);
  const [copias, setCopias] = useState(2);
  const [largura, setLargura] = useState(0);

  useEffect(() => {
    const c = caixa.current;
    const g = grupo.current;
    if (!c || !g || typeof ResizeObserver === "undefined") return;
    const medir = () => {
      const lg = g.getBoundingClientRect().width;
      setLargura(lg);
      setCopias(repeticoes(c.clientWidth, lg));
    };
    const ro = new ResizeObserver(medir);
    ro.observe(c);
    ro.observe(g);
    medir();
    return () => ro.disconnect();
  }, []);

  const style = largura
    ? ({
        "--carousel-shift": `-${largura}px`,
        "--carousel-duration": `${largura / speed}s`,
      } as CSSProperties)
    : undefined;

  return (
    <div ref={caixa} className="gc-carousel" aria-label={label}>
      <div className={`gc-carousel-track ${largura ? "is-measured" : ""}`} style={style}>
        {Array.from({ length: copias }, (_, copia) => (
          <div
            key={copia}
            ref={copia === 0 ? grupo : undefined}
            className="gc-carousel-group"
            aria-hidden={copia > 0}
          >
            {items.map((item) => (
              <span className="gc-carousel-chip" key={item.label}>
                <span className="gc-carousel-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function BarraBeneficios() {
  return (
    <div className="gc-benefits">
      <Carrossel items={BENEFICIOS} label="Benefícios" />
    </div>
  );
}

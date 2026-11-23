"use client";

import { useEffect, useState, type CSSProperties } from "react";

/*
 * Desfoque fixo no rodapé da tela — cópia do BottomBlur do EngajaEu 2.0
 * (src/components/landing/LandingEffects.tsx): 8 camadas, cada uma desfocando um pouco mais
 * (0,25px até 32px) e aparecendo só numa faixa, para o desfoque crescer suave até a borda.
 * Convida a pessoa a rolar a página. Não bloqueia cliques.
 */
const DESFOQUES = [0.25, 0.5, 1, 2, 4, 8, 16, 32];

export function DesfoqueRodape() {
  // Some quando a pessoa chega ao fim da página, para não embaçar o rodapé
  // No começo da página também fica escondido: a faixa azul dos benefícios aparece nítida (D41)
  const [noFim, setNoFim] = useState(true);
  useEffect(() => {
    const verificar = () => {
      const fim = document.documentElement.scrollHeight - window.innerHeight;
      setNoFim(window.scrollY < 40 || window.scrollY >= fim - 160);
    };
    verificar();
    window.addEventListener("scroll", verificar, { passive: true });
    window.addEventListener("resize", verificar);
    return () => {
      window.removeEventListener("scroll", verificar);
      window.removeEventListener("resize", verificar);
    };
  }, []);
  return (
    <div className={`gc-bottom-blur ${noFim ? "is-hidden" : ""}`} aria-hidden="true">
      {DESFOQUES.map((blur) => (
        <span
          key={blur}
          style={
            {
              backdropFilter: `blur(${blur}px)`,
              WebkitBackdropFilter: `blur(${blur}px)`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

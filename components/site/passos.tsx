"use client";

import { useEffect, useRef } from "react";
import {
  BadgeCheck,
  CreditCard,
  FileSignature,
  LayoutGrid,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
/** Passos do fluxo oficial (D28). */
const passos = [
  { titulo: "Escolha seu plano", texto: "200GB, 300GB ou 400GB. Escolha o que combina com você." },
  { titulo: "Cadastre-se e pague", texto: "Preencha seus dados e pague com PIX ou cartão." },
  {
    titulo: "Envie os dados do chip",
    texto: "eSIM: digite *#06# e envie o print. Chip físico: envie a foto do verso da embalagem.",
  },
  { titulo: "Assine o contrato", texto: "Tudo pelo e-mail, com seu documento e uma selfie." },
  { titulo: "Pronto. Linha ativada!", texto: "Você recebe seu número por e-mail. É só aproveitar." },
];

/*
 * "Poucos passos. Muitos gigas." — linha do tempo com os 5 passos do fluxo oficial
 * (plano/pagamento -> dados do chip: print do *#06# no eSIM ou verso da embalagem no chip
 * físico -> contrato com documento e selfie -> linha ativada).
 * Quando aparece na tela, a linha azul vai enchendo e cada passo acende em sequência.
 * No celular a linha fica na vertical.
 */

const ICONES: LucideIcon[] = [LayoutGrid, CreditCard, Smartphone, FileSignature, BadgeCheck];

export function PassosLinha() {
  const caixa = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = caixa.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.classList.add("motion-ready");
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          el.classList.add("is-visible");
          obs.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <ol ref={caixa} className="gc-steps-list">
      <span className="gc-steps-track" aria-hidden="true" />
      {passos.map((p, i) => {
        const Icone = ICONES[i] ?? BadgeCheck;
        const ultimo = i === passos.length - 1;
        return (
          <li
            key={p.titulo}
            className={`gc-step ${ultimo ? "is-last" : ""}`}
            style={{ "--i": i } as React.CSSProperties}
          >
            <span className="gc-step-dot" aria-hidden="true">
              <Icone size={24} />
              <em>{String(i + 1).padStart(2, "0")}</em>
            </span>
            <div className="gc-step-body">
              <h3>{p.titulo}</h3>
              <p>{p.texto}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function SecaoPassos() {
  return (
    <section id="como-funciona" className="gc-steps t-dark scroll-mt-24">
      <div className="container-site">
        <div className="text-center">
          <p className="section-eyebrow">DO SEU CELULAR, SEM COMPLICAÇÃO</p>
          <h2 className="section-title">
            Poucos passos.
            <br />
            <span className="gc-text-gradient">Muitos gigas.</span>
          </h2>
          <p className="section-description">
            Você escolhe, paga e assina daqui mesmo. A gente cuida do resto e avisa por e-mail
            quando a linha estiver ativa.
          </p>
        </div>
        <PassosLinha />
      </div>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Phone, Pointer } from "lucide-react";

/*
 * Animações do passo a passo do eSIM, desenhadas em código (nítidas em qualquer tela e leves):
 *   1. app de ligações piscando e o dedo tocando · 2. teclado digitando *#06#
 *   3. tela com IMEI e EID aparecendo · 4. botões do print piscando e o "flash" da captura
 * Mudam conforme o celular da pessoa (iPhone ou Android).
 */

export type Sistema = "ios" | "android";

/** Descobre se é iPhone (só no navegador). */
export function detectarSistema(): Sistema {
  if (typeof navigator === "undefined") return "android";
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "ios" : "android";
}

const semMovimento = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function TelaInicial() {
  return (
    <div className="dm-home">
      <div className="dm-grid">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className="dm-app" />
        ))}
      </div>
      <div className="dm-dock">
        <span className="dm-app dm-app-phone">
          <Phone size={18} />
          <em>Telefone</em>
        </span>
        <span className="dm-app" />
        <span className="dm-app" />
        <span className="dm-app" />
      </div>
      <span className="dm-finger" aria-hidden="true">
        <Pointer size={30} fill="#fff" />
      </span>
    </div>
  );
}

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
const CODIGO = "*#06#";

function Teclado() {
  const [n, setN] = useState(semMovimento() ? CODIGO.length : 0);
  useEffect(() => {
    if (semMovimento()) return;
    const id = window.setInterval(() => setN((v) => (v >= CODIGO.length + 2 ? 0 : v + 1)), 650);
    return () => window.clearInterval(id);
  }, []);
  const digitado = CODIGO.slice(0, Math.min(n, CODIGO.length));
  const tecla = n >= 1 && n <= CODIGO.length ? CODIGO[n - 1] : null;
  return (
    <div className="dm-dialer">
      <div className="dm-display">{digitado || <span className="dm-caret">|</span>}</div>
      <div className="dm-keys">
        {TECLAS.map((k) => (
          <span key={k} className={`dm-key ${tecla === k ? "is-pressed" : ""}`}>
            {k}
          </span>
        ))}
      </div>
      <span className="dm-call" aria-hidden="true">
        <Phone size={16} />
      </span>
    </div>
  );
}

function TelaRegistro({ os }: { os: Sistema }) {
  return (
    <div className="dm-info">
      <p className="dm-info-title">{os === "ios" ? "Informações do Aparelho" : "IMEI"}</p>
      <div className="dm-info-row" style={{ animationDelay: "0.2s" }}>
        <small>EID</small>
        <b>8904 9032 0000 …</b>
      </div>
      <div className="dm-info-row" style={{ animationDelay: "0.6s" }}>
        <small>IMEI</small>
        <b>35 209900 176148 1</b>
      </div>
      <div className="dm-info-row" style={{ animationDelay: "1s" }}>
        <small>IMEI2</small>
        <b>35 209900 176149 9</b>
      </div>
      <span className="dm-info-ok">OK</span>
    </div>
  );
}

function Print({ os }: { os: Sistema }) {
  return (
    <div className="dm-shot">
      <TelaRegistro os={os} />
      <span className="dm-flash" aria-hidden="true" />
    </div>
  );
}

/** Celular com a animação do passo (1 a 4). */
export function CelularGuia({ passo, os }: { passo: number; os: Sistema }) {
  return (
    <div
      className={`dm-phone dm-${os} dm-step-${passo}`}
      role="img"
      aria-label={`Animação do passo ${passo}`}
    >
      {/* botões laterais: piscam no passo do print */}
      <span className="dm-btn dm-btn-side" />
      <span className="dm-btn dm-btn-vol-up" />
      <span className="dm-btn dm-btn-vol-down" />
      <div className="dm-screen">
        <span className="dm-notch" />
        {passo === 1 && <TelaInicial />}
        {passo === 2 && <Teclado />}
        {passo === 3 && <TelaRegistro os={os} />}
        {passo === 4 && <Print os={os} />}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Info, X } from "lucide-react";
import { WATCH_TV, WATCH_TV_CANAIS, WATCH_TV_PACOTE } from "@/lib/domain/watch-tv";
import "./watch-canais.css";

const semInscricao = () => () => {};

/**
 * Bolinha de informação (ⓘ) que abre a grade de canais da Watch TV (D44). Fica dentro das
 * caixinhas de marcar: o clique NÃO marca/desmarca a Watch, só abre a lista.
 */
export function WatchCanaisInfo({ tone = "orange" }: { tone?: "orange" | "white" }) {
  const [aberto, setAberto] = useState(false);
  // Só no navegador (o diálogo vai para o <body>); no servidor fica de fora
  const montado = useSyncExternalStore(semInscricao, () => true, () => false);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto, montado]);

  const abrir = (e: MouseEvent) => {
    e.preventDefault(); // não marca a caixinha em volta
    e.stopPropagation();
    setAberto(true);
  };

  return (
    <>
      <button type="button" className={`wt-info is-${tone}`} onClick={abrir} aria-label="Ver os canais da Watch TV" title="Ver os canais">
        <Info size={16} strokeWidth={2.4} />
      </button>
      {montado &&
        createPortal(
          <dialog
            ref={ref}
            className="wt-canais"
            onClose={() => setAberto(false)}
            onClick={(e) => {
              if (e.target === e.currentTarget) setAberto(false); // clique fora fecha
            }}
            aria-labelledby="wt-canais-titulo"
          >
            <div className="wt-canais-box">
              <header className="wt-canais-head">
                {/* eslint-disable-next-line @next/next/no-img-element -- logo pequena e estática */}
                <img src="/watch-tv.png" alt="" width={44} height={44} />
                <span>
                  <strong id="wt-canais-titulo">Canais da {WATCH_TV.nome}</strong>
                  <small>
                    Pacote {WATCH_TV_PACOTE.nome} · {WATCH_TV_PACOTE.canais} canais · até {WATCH_TV.telas} TVs ao mesmo tempo · IPTV legalizado
                  </small>
                </span>
                <button type="button" className="wt-canais-x" onClick={() => setAberto(false)} aria-label="Fechar">
                  <X size={20} />
                </button>
              </header>
              <div className="wt-canais-body">
                {WATCH_TV_CANAIS.map((secao) => (
                  <section key={secao.titulo}>
                    <h3>{secao.titulo}</h3>
                    {secao.grupos.map((g) => (
                      <div key={g.nome} className="wt-canais-grupo">
                        <p>
                          {g.nome} <em>{g.canais.length}</em>
                        </p>
                        <ul>
                          {g.canais.map((c) => (
                            <li key={c}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </section>
                ))}
                <a href="/watch-canais.webp" target="_blank" rel="noopener noreferrer" className="wt-canais-img">
                  Ver a grade com as logos
                </a>
                <p className="wt-canais-nota">Grade informada pela Watch; pode mudar sem aviso.</p>
              </div>
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}

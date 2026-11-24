"use client";

/* eslint-disable @next/next/no-img-element -- logo pequena e estática */
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { WATCH_TV } from "@/lib/domain/watch-tv";

const reais = (cents: number) => {
  const r = Math.floor(cents / 100).toLocaleString("pt-BR");
  return `R$ ${r},${String(cents % 100).padStart(2, "0")}`;
};

/**
 * Parte de baixo do cartão de plano: caixinha "Adicionar Watch TV" (D44, sempre começa DESMARCADA)
 * + mensalidade + botão. Marcando, o preço soma na hora e o formulário já abre com a TV marcada.
 */
export function PlanWatchFoot({ slug, priceCents, porGb }: { slug: string; priceCents: number; porGb: string }) {
  const [tv, setTv] = useState(false);
  const total = priceCents + (tv ? WATCH_TV.precoCents : 0);
  return (
    <>
      <label className={`gc-watch ${tv ? "is-on" : ""}`}>
        <input type="checkbox" checked={tv} onChange={(e) => setTv(e.target.checked)} />
        <span className="gc-watch-box" aria-hidden="true">
          <Check size={14} strokeWidth={4} />
        </span>
        <img src="/watch-tv.png" alt="" width={30} height={30} />
        <span className="gc-watch-text">
          Adicionar <b>{WATCH_TV.nome}</b> <b className="gc-watch-price">+ {reais(WATCH_TV.precoCents)}/mês</b>
          <small>Canais ao vivo, filmes e séries em até {WATCH_TV.telas} TVs · IPTV legalizado</small>
        </span>
      </label>

      <div className="gc-plan-foot">
        <p className="gc-plan-label">Mensalidade</p>
        <div className="gc-plan-price">
          {reais(total)}
          <span>/mês</span>
        </div>
        {tv ? (
          <p className="gc-watch-conta">
            Linha {reais(priceCents)} + <b>Watch TV {reais(WATCH_TV.precoCents)}</b>
          </p>
        ) : (
          <p className="gc-plan-pergb">
            Sai a <b>R$ {porGb}</b> por GB
          </p>
        )}
        <Link href={`/contratar/${slug}${tv ? "?tv=1" : ""}`} className="gc-plan-cta">
          <span className="gc-plan-cta-text">
            {tv ? "Quero este combo" : "Quero este plano"} <ArrowRight size={18} />
          </span>
        </Link>
      </div>
    </>
  );
}

"use client";

import { useState } from "react";

/**
 * Gráfico de receita por dia (ou por hora) da Visão geral. Uma série só (azul da marca), barras
 * finas com ponta arredondada, grade discreta e detalhe ao passar o mouse/tocar.
 */
export type SalesPoint = { bucket: string; receitaCents: number; vendas: number };

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const compacto = (c: number) => {
  const v = c / 100;
  if (v >= 1000) return `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
};

/** Teto "redondo" para o eixo (ex.: 2.110 → 2.500). */
function tetoRedondo(maxCents: number) {
  if (maxCents <= 0) return 10_000;
  const v = maxCents / 100;
  const p = 10 ** Math.floor(Math.log10(v));
  const passo = [1, 2, 3, 4, 5, 6, 8, 10].map((m) => m * p).find((x) => x >= v) ?? 10 * p;
  return passo * 100;
}

function rotulo(bucket: string, porHora: boolean, longo = false) {
  const [data, hora] = bucket.split("T");
  const [, m, d] = data!.split("-");
  if (porHora) return `${hora}h`;
  if (longo) {
    const dt = new Date(`${data}T12:00:00Z`);
    const sem = dt.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "");
    return `${sem}, ${d}/${m}`;
  }
  return `${d}/${m}`;
}

export function SalesChart({ points, porHora }: { points: SalesPoint[]; porHora: boolean }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const teto = tetoRedondo(Math.max(0, ...points.map((p) => p.receitaCents)));
  const n = points.length;
  // mostra no máximo ~8 rótulos no eixo de baixo
  const cadaQuantos = Math.max(1, Math.ceil(n / 8));
  const p = ativo !== null ? points[ativo] : null;

  return (
    <div className="sc-wrap">
      <div className="sc-plot" onMouseLeave={() => setAtivo(null)}>
        {[1, 0.5, 0].map((f) => (
          <div key={f} className="sc-grid" style={{ bottom: `${f * 100}%` }}>
            <span>{compacto(teto * f)}</span>
          </div>
        ))}
        <div className="sc-bars" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {points.map((pt, i) => (
            <button
              key={pt.bucket}
              type="button"
              className={`sc-slot ${ativo === i ? "is-on" : ""}`}
              onMouseEnter={() => setAtivo(i)}
              onFocus={() => setAtivo(i)}
              onClick={() => setAtivo(i)}
              aria-label={`${rotulo(pt.bucket, porHora, true)}: ${brl(pt.receitaCents)}, ${pt.vendas} vendas`}
            >
              <span className="sc-bar" style={{ height: pt.receitaCents ? `max(4px, ${(pt.receitaCents / teto) * 100}%)` : "0" }} />
            </button>
          ))}
        </div>
        {p && ativo !== null && (
          <div className="sc-tip" style={{ left: `${((ativo + 0.5) / n) * 100}%` }} role="status">
            <strong>{rotulo(p.bucket, porHora, true)}</strong>
            <span>{brl(p.receitaCents)}</span>
            <small>
              {p.vendas} {p.vendas === 1 ? "venda nova" : "vendas novas"}
            </small>
          </div>
        )}
      </div>
      <div className="sc-axis" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {points.map((pt, i) => (
          <span key={pt.bucket}>{i % cadaQuantos === 0 || i === n - 1 ? rotulo(pt.bucket, porHora) : ""}</span>
        ))}
      </div>
      {/* tabela para leitores de tela */}
      <table className="sr-only">
        <caption>Receita e vendas por {porHora ? "hora" : "dia"}</caption>
        <tbody>
          {points.map((pt) => (
            <tr key={pt.bucket}>
              <th scope="row">{rotulo(pt.bucket, porHora, true)}</th>
              <td>{brl(pt.receitaCents)}</td>
              <td>{pt.vendas} vendas</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Formulário do período personalizado (abre ao clicar em "Personalizado"). */
export function PeriodoPersonalizado({ de, ate, hoje, aberto }: { de: string; ate: string; hoje: string; aberto: boolean }) {
  const [open, setOpen] = useState(aberto);
  return (
    <div className="sc-custom">
      <button type="button" className={`sc-chip ${aberto ? "is-on" : ""}`} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        Personalizado
      </button>
      {open && (
        <form className="sc-custom-form" method="get">
          <input type="hidden" name="periodo" value="personalizado" />
          <label>
            De
            <input type="date" name="de" defaultValue={de} max={hoje} required />
          </label>
          <label>
            Até
            <input type="date" name="ate" defaultValue={ate} max={hoje} required />
          </label>
          <button type="submit">Ver</button>
        </form>
      )}
    </div>
  );
}

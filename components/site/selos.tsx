/* eslint-disable @next/next/no-img-element -- logo pequena e estática */
/**
 * Selos de confiança do rodapé, em quadrados brancos (D41). Desenhados em SVG (nítidos em qualquer
 * tela). A garantia de "dinheiro de volta" é a do contrato: desistência em até 7 dias (CDC art. 49).
 */

function SeloCompraSegura() {
  return (
    <svg viewBox="0 0 200 110" role="img" aria-label="SSL — Compra 100% segura">
      <defs>
        <linearGradient id="sl-o" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb02e" />
          <stop offset="1" stopColor="#f07800" />
        </linearGradient>
        <linearGradient id="sl-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e6e9ee" />
          <stop offset="1" stopColor="#9aa3ad" />
        </linearGradient>
      </defs>
      <rect x="4" y="22" width="192" height="80" rx="16" fill="none" stroke="#f7a43b" strokeWidth="2" />
      <path d="M26 46 v-12 a22 22 0 0 1 44 0 v12" fill="none" stroke="url(#sl-g)" strokeWidth="9" />
      <path d="M48 42 l26 8 v18 c0 16 -11 26 -26 32 c-15 -6 -26 -16 -26 -32 v-18 z" fill="url(#sl-o)" stroke="#d96a00" strokeWidth="1.5" />
      <text x="48" y="78" textAnchor="middle" fontSize="15" fontWeight="800" fill="#5b3b00">SSL</text>
      <text x="138" y="48" textAnchor="middle" fontSize="15" fontWeight="600" fill="#222">COMPRA</text>
      <text x="138" y="76" textAnchor="middle" fontSize="30" fontWeight="900" fill="#f07800">100%</text>
      <text x="138" y="95" textAnchor="middle" fontSize="15" fontWeight="600" fill="#222">SEGURA</text>
    </svg>
  );
}

function SeloGarantia() {
  const pontas = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    const r = i % 2 ? 40 : 47;
    return `${(60 + r * Math.cos(a)).toFixed(2)},${(52 + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 120 110" role="img" aria-label="Satisfação garantida ou 100% do seu dinheiro de volta">
      <defs>
        <linearGradient id="sg-d" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff1a8" />
          <stop offset="0.5" stopColor="#e3a800" />
          <stop offset="1" stopColor="#a86c00" />
        </linearGradient>
      </defs>
      <polygon points={pontas} fill="url(#sg-d)" />
      <circle cx="60" cy="52" r="34" fill="#1f2937" stroke="#f5c542" strokeWidth="2.5" />
      <text x="60" y="36" textAnchor="middle" fontSize="6.8" fontWeight="800" fill="#f5c542">SATISFAÇÃO</text>
      <text x="60" y="44" textAnchor="middle" fontSize="6.8" fontWeight="800" fill="#f5c542">GARANTIDA OU</text>
      <text x="60" y="64" textAnchor="middle" fontSize="18" fontWeight="900" fill="#ffd34d">100%</text>
      <path d="M2 74 h116 l-7 9 l7 9 h-116 l7 -9 z" fill="#1557b0" />
      <text x="60" y="86" textAnchor="middle" fontSize="6.6" fontWeight="800" fill="#fff">DO SEU DINHEIRO DE VOLTA</text>
    </svg>
  );
}

function SeloProtegido() {
  return (
    <svg viewBox="0 0 200 110" role="img" aria-label="Protegido — Site seguro">
      <defs>
        <linearGradient id="sp-v" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7fd34f" />
          <stop offset="1" stopColor="#2e7d1a" />
        </linearGradient>
      </defs>
      <path d="M38 14 l32 10 v28 c0 24 -14 38 -32 46 c-18 -8 -32 -22 -32 -46 v-28 z" fill="#b8c0c8" />
      <path d="M38 20 l26 8 v24 c0 20 -11 32 -26 39 c-15 -7 -26 -19 -26 -39 v-24 z" fill="url(#sp-v)" />
      <path d="M38 20 v71 c-15 -7 -26 -19 -26 -39 v-24 z" fill="#ffffff" opacity="0.18" />
      <path d="M25 52 l9 9 l17 -19" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="66" y="36" width="130" height="30" rx="7" fill="#111" />
      <text x="131" y="58" textAnchor="middle" fontSize="19" fontWeight="900" fill="#fff" letterSpacing="0.5">PROTEGIDO</text>
      <text x="131" y="90" textAnchor="middle" fontSize="17" fontWeight="500" fill="#222">Site Seguro</text>
    </svg>
  );
}

export function SelosConfianca({ reclameAqui }: { reclameAqui: string }) {
  return (
    <div className="gc-selos">
      <a href={reclameAqui} target="_blank" rel="noopener noreferrer" className="gc-selo gc-selo-ra" aria-label="Ver a Gigachip no Reclame Aqui (abre em nova aba)">
        <small>Estamos no</small>
        <strong>
          Reclame <em>AQUI</em>
        </strong>
      </a>
      <span className="gc-selo">
        <small>Pagamentos processados por</small>
        <img src="/asaas-logo.png" alt="Asaas" width={92} height={25} />
      </span>
      <span className="gc-selo">
        <SeloCompraSegura />
      </span>
      <span className="gc-selo">
        <SeloGarantia />
      </span>
      <span className="gc-selo">
        <SeloProtegido />
      </span>
    </div>
  );
}

import { IconCalendar } from "./icons";

/** Celular do topo (desenhado em código, igual à imagem do Lovable): "Minha linha", 228 GB restantes. */
export function PhoneHero() {
  const r = 70;
  const c = 2 * Math.PI * r;
  return (
    <div className="phone-wrap" aria-label="Celular mostrando 228 GB restantes e renovação no dia 20" role="img">
      <div className="phone">
        <div className="phone-screen">
          <div className="phone-notch" />
          <div className="phone-g">G</div>
          <p className="phone-title">Minha linha</p>
          <p className="phone-sub">Internet disponível</p>
          <div className="gauge">
            <svg viewBox="0 0 160 160" aria-hidden>
              <defs>
                <linearGradient id="gc-gauge" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#7fdcff" />
                  <stop offset="1" stopColor="#0a82c7" />
                </linearGradient>
              </defs>
              <circle cx="80" cy="80" r={r} fill="none" stroke="#e3eef5" strokeWidth="10" />
              <circle cx="80" cy="80" r={r} fill="none" stroke="url(#gc-gauge)" strokeWidth="10" strokeLinecap="round"
                strokeDasharray={c} strokeDashoffset={c * (1 - 228 / 300)} />
            </svg>
            <div className="gauge-text"><strong>228</strong><span>GB restantes</span></div>
          </div>
          <div className="phone-renew"><IconCalendar /> Renova dia 20</div>
        </div>
      </div>
      {/* chip físico ao lado */}
      <svg className="sim-card" viewBox="0 0 80 110" aria-hidden>
        <path d="M10 2 H56 L78 24 V100 Q78 108 70 108 H10 Q2 108 2 100 V10 Q2 2 10 2 Z" fill="#fff" stroke="#dfe5ec" strokeWidth="2" />
        <text x="16" y="34" fontSize="22" fontWeight="700" fontStyle="italic" fill="#04070d">G</text>
        <rect x="18" y="48" width="44" height="42" rx="8" fill="#e2b45f" />
        <g stroke="#a87a2c" strokeWidth="2" fill="none" opacity="0.7">
          <path d="M18 62 H34 V48" /><path d="M62 62 H46 V48" /><path d="M18 76 H34 V90" /><path d="M62 76 H46 V90" /><rect x="34" y="62" width="12" height="14" rx="2" />
        </g>
      </svg>
    </div>
  );
}

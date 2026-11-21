import { IconArrows, IconPhone, IconSignal, IconWifi } from "./icons";

/** Chip (SIM) em "3D" com ícones flutuando — ilustração do topo da página inicial. */
export function ChipIllustration({ className = "" }: { className?: string }) {
  const badge = "absolute flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-ink-soft/80 text-neon-cyan shadow-[0_0_24px_-4px_rgb(1_186_254/0.6)] backdrop-blur";
  return (
    <div className={`relative aspect-square w-full ${className}`} aria-hidden>
      <div className="absolute inset-[18%] rounded-full bg-neon opacity-25 blur-3xl" />
      <svg viewBox="0 0 420 420" className="relative h-full w-full">
        <defs>
          <linearGradient id="gc-neon" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#01bafe" />
            <stop offset="0.55" stopColor="#34fba6" />
            <stop offset="1" stopColor="#d8fd0d" />
          </linearGradient>
          <linearGradient id="gc-body" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1a2740" />
            <stop offset="1" stopColor="#060a12" />
          </linearGradient>
          <linearGradient id="gc-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fbe3a1" />
            <stop offset="0.5" stopColor="#e1b45c" />
            <stop offset="1" stopColor="#b88433" />
          </linearGradient>
          <filter id="gc-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* rede de conexões */}
        <g stroke="#01bafe" strokeOpacity="0.35" strokeWidth="1.2">
          <path d="M40 300 L120 250" /><path d="M300 110 L380 60" /><path d="M330 300 L400 330" /><path d="M60 120 L120 150" />
        </g>
        <g fill="#34fba6">
          <circle cx="40" cy="300" r="4" /><circle cx="380" cy="60" r="4" /><circle cx="400" cy="330" r="3" /><circle cx="60" cy="120" r="3" />
        </g>
        {/* chip inclinado */}
        <g transform="rotate(-14 210 210)">
          <path d="M140 70 H262 L322 130 V340 Q322 362 300 362 H140 Q118 362 118 340 V92 Q118 70 140 70 Z" fill="url(#gc-body)" stroke="url(#gc-neon)" strokeWidth="4" filter="url(#gc-glow)" />
          <path d="M146 84 H256 L308 136 V334 Q308 348 294 348 H146 Q132 348 132 334 V98 Q132 84 146 84 Z" fill="none" stroke="#ffffff" strokeOpacity="0.07" strokeWidth="2" />
          <g stroke="#ffffff" strokeOpacity="0.35" strokeWidth="5" strokeLinecap="round">
            <path d="M156 118 H196" /><path d="M156 134 H214" /><path d="M200 318 H280" /><path d="M222 332 H270" />
          </g>
          {/* contatos dourados */}
          <rect x="164" y="170" width="112" height="104" rx="18" fill="url(#gc-gold)" />
          <g stroke="#8a5f1e" strokeOpacity="0.55" strokeWidth="3" fill="none">
            <path d="M164 206 H200 V184" /><path d="M276 206 H240 V184" /><path d="M164 240 H200 V262" /><path d="M276 240 H240 V262" />
            <rect x="204" y="206" width="32" height="34" rx="5" />
          </g>
        </g>
      </svg>
      <span className={`${badge} float-slow left-[2%] top-[44%]`}><IconPhone className="h-5 w-5" /></span>
      <span className={`${badge} float-slower right-[6%] top-[12%]`}><IconWifi className="h-5 w-5" /></span>
      <span className={`${badge} float-slow bottom-[10%] right-[14%]`}><IconArrows className="h-5 w-5" /></span>
      <span className="float-slower absolute bottom-[14%] left-[24%] text-neon-green"><IconSignal className="h-7 w-7" /></span>
    </div>
  );
}

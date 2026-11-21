"use client";

/* eslint-disable @next/next/no-img-element -- ícone pequeno e estático */
import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import {
  BarChart3,
  Camera,
  CircleHelp,
  House,
  MessageCircle,
  Music2,
  Play,
  RefreshCw,
  Wifi,
} from "lucide-react";

/**
 * Celular do topo desenhado em código, com o app da Gigachip aberto e "vivo":
 * a cada poucos segundos passa um dia do mês, chega uma notificação de uso
 * ("Instagram · usando há 30 min", depois 1h, 1h 30min...) e o consumo, o gráfico e os apps
 * sobem juntos. No fim do mês o plano renova com internet sobrando — nunca chega aos 200GB.
 * Os números são só ilustrativos.
 */

const PLANO_GB = 200;
const DIAS = 30;
const DIA_INICIAL = 12;
const INTERVALO_MS = 2600;

type App = {
  nome: string;
  cor: string;
  Icone: ComponentType<{ className?: string }>;
};

const APPS: App[] = [
  { nome: "TikTok", cor: "bg-[#0b0f17]", Icone: Music2 },
  {
    nome: "Instagram",
    cor: "bg-gradient-to-tr from-[#f9a43a] via-[#e1306c] to-[#7b3fe4]",
    Icone: Camera,
  },
  { nome: "YouTube", cor: "bg-[#ff0033]", Icone: Play },
  { nome: "WhatsApp", cor: "bg-[#25d366]", Icone: MessageCircle },
];

// quanto cada app costuma pesar no dia (TikTok, Instagram, YouTube, WhatsApp)
const PESO = [0.32, 0.25, 0.22, 0.09];
const PESO_OUTROS = 0.12;
// quanto cada app gasta por hora de uso (TikTok, Instagram, YouTube, WhatsApp), só ilustrativo
const GB_POR_HORA = [0.8, 0.6, 1, 0.1];
// ordem das notificações
const ROTACAO = [1, 0, 2, 1, 3, 0, 2];

type Notificacao =
  | { id: number; tipo: "uso"; app: number; minutos: number }
  | { id: number; tipo: "renovou"; sobra: number };

type Estado = {
  dia: number;
  historico: number[]; // consumo acumulado no fim de cada dia (índice 0 = dia 1)
  apps: number[];
  outros: number;
  minutos: number[]; // há quanto tempo cada app está "em uso"
  passo: number;
  notas: { esquerda: Notificacao; direita: Notificacao };
};

function inicial(): Estado {
  // dias 1..12 com uso variado, terminando em 68 GB
  const diario = [5.1, 6.3, 4.4, 7.2, 5.8, 4.9, 6.6, 5.4, 4.8, 6.9, 5.3, 5.3];
  const historico: number[] = [];
  let total = 0;
  for (const d of diario) {
    total += d;
    historico.push(Math.round(total * 10) / 10);
  }
  return {
    dia: DIA_INICIAL,
    historico,
    apps: [22, 17, 14, 6.6],
    outros: total - 59.6,
    minutos: [60, 30, 60, 30],
    passo: 0,
    notas: {
      esquerda: { id: -2, tipo: "uso", app: 1, minutos: 30 },
      direita: { id: -1, tipo: "uso", app: 2, minutos: 60 },
    },
  };
}

function avancar(e: Estado): Estado {
  const lado = e.passo % 2 === 0 ? "esquerda" : "direita";
  const passo = e.passo + 1;

  // fim do mês: renova com internet sobrando e começa de novo
  if (e.dia >= DIAS) {
    const usado = e.historico[e.historico.length - 1] ?? 0;
    const sobra = Math.round(PLANO_GB - usado);
    const primeiroDia = 4.6;
    return {
      dia: 1,
      historico: [primeiroDia],
      apps: PESO.map((p) => Math.round(primeiroDia * p * 10) / 10),
      outros: primeiroDia * PESO_OUTROS,
      minutos: [0, 0, 0, 0],
      passo,
      notas: { ...e.notas, [lado]: { id: passo, tipo: "renovou", sobra } },
    };
  }

  const app = ROTACAO[e.passo % ROTACAO.length]!;
  // cada sessão vai de 30 min até 3h; depois começa uma nova
  const minutos = e.minutos.map((m, i) => (i === app ? (m >= 180 ? 30 : m + 30) : m));
  // uso do dia entre 4 e 6,5 GB: no fim do mês fica perto de 170 GB, longe dos 200
  const doDia = 4 + Math.random() * 2.5;
  const apps = e.apps.map((v, i) => {
    const parte = i === app ? 0.4 : (PESO[i]! / (1 - PESO[app]!)) * (0.6 - PESO_OUTROS);
    return v + doDia * parte;
  });
  const outros = e.outros + doDia * PESO_OUTROS;
  const anterior = e.historico[e.historico.length - 1] ?? 0;
  return {
    dia: e.dia + 1,
    historico: [...e.historico, Math.min(PLANO_GB - 15, anterior + doDia)],
    apps,
    outros,
    minutos,
    passo,
    notas: { ...e.notas, [lado]: { id: passo, tipo: "uso", app, minutos: minutos[app]! } },
  };
}

// no servidor não existe layout: evita o aviso e mostra o número final
const useIsoLayoutEffect = typeof window === "undefined" ? () => {} : useLayoutEffect;

const semMovimento = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Número que desliza até o valor novo (na primeira vez, sai do zero). */
function useNumero(alvo: number, ms = 900, atrasoInicial = 300) {
  const [valor, setValor] = useState(alvo);
  const atual = useRef(alvo);
  const primeira = useRef(true);
  useIsoLayoutEffect(() => {
    if (semMovimento()) {
      atual.current = alvo;
      setValor(alvo);
      return;
    }
    const de = primeira.current ? 0 : atual.current;
    const atraso = primeira.current ? atrasoInicial : 0;
    primeira.current = false;
    let raf = 0;
    const inicio = performance.now() + atraso;
    const quadro = (agora: number) => {
      const t = Math.min(1, Math.max(0, (agora - inicio) / ms));
      const v = de + (alvo - de) * (1 - Math.pow(1 - t, 3));
      atual.current = v;
      setValor(v);
      if (t < 1) raf = requestAnimationFrame(quadro);
    };
    raf = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(raf);
  }, [alvo]);
  return valor;
}

const gb = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function renova(faltam: number) {
  if (faltam <= 0) return "Renova amanhã";
  return faltam === 1 ? "Renova em 1 dia" : `Renova em ${faltam} dias`;
}

function tempo(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

/** Curva suave passando pelos pontos (Catmull-Rom convertido em Bézier). */
function curva(pontos: [number, number][]) {
  const ponto = (i: number) => pontos[Math.min(pontos.length - 1, Math.max(0, i))]!;
  let d = `M${ponto(0)[0].toFixed(1)},${ponto(0)[1].toFixed(1)}`;
  for (let i = 0; i < pontos.length - 1; i++) {
    const [x0, y0] = ponto(i - 1);
    const [x1, y1] = ponto(i);
    const [x2, y2] = ponto(i + 1);
    const [x3, y3] = ponto(i + 2);
    const c1 = `${(x1 + (x2 - x0) / 6).toFixed(1)},${(y1 + (y2 - y0) / 6).toFixed(1)}`;
    const c2 = `${(x2 - (x3 - x1) / 6).toFixed(1)},${(y2 - (y3 - y1) / 6).toFixed(1)}`;
    d += ` C${c1} ${c2} ${x2.toFixed(1)},${y2.toFixed(1)}`;
  }
  return d;
}

function GraficoConsumo({ historico }: { historico: number[] }) {
  const W = 240;
  const H = 80;
  const topo = 8; // linha do limite de 200 GB
  const x = (i: number) => (i / (DIAS - 1)) * W;
  const y = (v: number) => H - (v / PLANO_GB) * (H - topo);
  const pontos = historico.map((v, i) => [x(i), y(v)] as [number, number]);
  const linha = curva(pontos);
  const [ux, uy] = pontos[pontos.length - 1]!;
  const area = `${linha} L${ux.toFixed(1)},${H} L0,${H} Z`;
  return (
    <div className="app-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="gc-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#01bafe" stopOpacity="0.35" />
            <stop offset="1" stopColor="#01bafe" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gc-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#7fdcff" />
            <stop offset="1" stopColor="#0a82c7" />
          </linearGradient>
        </defs>
        <line x1="0" x2={W} y1={topo} y2={topo} className="app-chart-limit" />
        {[0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} className="app-chart-grid" />
        ))}
        <path d={area} fill="url(#gc-area)" className="app-chart-path" />
        <path
          d={linha}
          fill="none"
          stroke="url(#gc-line)"
          strokeWidth="2.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className="app-chart-path"
        />
      </svg>
      <span className="app-chart-limit-label">limite 200 GB</span>
      <span
        className="app-chart-dot"
        style={{ left: `${(ux / W) * 100}%`, top: `${(uy / H) * 100}%` }}
      />
      <div className="app-chart-axis">
        <span>dia 1</span>
        <span>dia 15</span>
        <span>dia 30</span>
      </div>
    </div>
  );
}

function AppLinha({ app, valor, maior, i }: { app: App; valor: number; maior: number; i: number }) {
  const v = useNumero(valor, 900, 700 + i * 150);
  const Icone = app.Icone;
  return (
    <li className="app-row">
      <span className={`app-icon ${app.cor}`}>
        <Icone className="h-3.5 w-3.5 text-white" />
      </span>
      <span className="app-row-main">
        <span className="app-row-top">
          <span>{app.nome}</span>
          <strong>{gb(v)} GB</strong>
        </span>
        <span className="app-bar">
          <span
            style={{ width: `${(valor / maior) * 100}%`, animationDelay: `${0.7 + i * 0.15}s` }}
          />
        </span>
      </span>
    </li>
  );
}

function CartaoNotificacao({ nota, lado }: { nota: Notificacao; lado: "esquerda" | "direita" }) {
  if (nota.tipo === "renovou") {
    return (
      <div className={`notif notif-${lado}`}>
        <span className="notif-icon bg-gradient-to-br from-[#33c8ff] to-[#0a82c7]">
          <RefreshCw className="h-4 w-4 text-white" />
        </span>
        <span className="notif-body">
          <span className="notif-top">
            <strong>Gigachip</strong>
            <small>agora</small>
          </span>
          <span className="notif-text">
            Plano renovado! Sobraram <b>{nota.sobra} GB</b>.
          </span>
        </span>
        <span className="notif-timer" aria-hidden="true" />
      </div>
    );
  }
  const app = APPS[nota.app]!;
  const Icone = app.Icone;
  return (
    <div className={`notif notif-${lado}`}>
      <span className={`notif-icon ${app.cor}`}>
        <Icone className="h-4 w-4 text-white" />
      </span>
      <span className="notif-body">
        <span className="notif-top">
          <strong>{app.nome}</strong>
          <small>agora</small>
        </span>
        <span className="notif-text">
          Usando há {tempo(nota.minutos)} ·{" "}
          <b>{gb((nota.minutos / 60) * (GB_POR_HORA[nota.app] ?? 0.5))} GB</b>
        </span>
      </span>
      <span className="notif-timer" aria-hidden="true" />
    </div>
  );
}

export function PhoneHero() {
  const [estado, setEstado] = useState(inicial);

  useEffect(() => {
    if (semMovimento()) return;
    const id = window.setInterval(() => {
      if (document.hidden) return; // aba escondida: espera
      setEstado(avancar);
    }, INTERVALO_MS);
    return () => window.clearInterval(id);
  }, []);

  const usadoReal = estado.historico[estado.historico.length - 1] ?? 0;
  const usado = useNumero(usadoReal, 900, 300);
  const restante = Math.max(0, PLANO_GB - usado);
  const maior = Math.max(...estado.apps);

  return (
    <div
      className="phone-wrap"
      role="img"
      aria-label="App da Gigachip no celular: plano de 200GB, o consumo sobe ao longo do mês conforme os aplicativos são usados e sempre sobra internet"
    >
      {/* notificações de uso chegando ao lado do celular */}
      <CartaoNotificacao
        key={`e${estado.notas.esquerda.id}`}
        nota={estado.notas.esquerda}
        lado="esquerda"
      />
      <CartaoNotificacao
        key={`d${estado.notas.direita.id}`}
        nota={estado.notas.direita}
        lado="direita"
      />

      <div className="phone">
        <div className="phone-screen">
          <div className="phone-status">
            <span>9:41</span>
            <span className="phone-cam" aria-hidden="true" />
            <span className="phone-signal">
              <i />
              <i />
              <i />
              <i />
            </span>
          </div>

          <div className="app-head">
            <span className="app-logo">
              <img src="/logo-g.png" alt="" width={22} height={17} />
            </span>
            <span>
              <small>Olá, Ana</small>
              <strong>Minha Gigachip</strong>
            </span>
            <span className="app-live">
              <i /> Linha ativa
            </span>
          </div>

          <div className="app-plan">
            <div className="app-plan-top">
              <span>Seu plano</span>
              <span className="app-plan-tag">{PLANO_GB}GB · Rede Vivo</span>
            </div>
            <div className="app-plan-gb">
              {Math.floor(restante)}
              <small> GB restantes</small>
            </div>
            <div className="app-plan-bar">
              <span style={{ width: `${(restante / PLANO_GB) * 100}%` }} />
            </div>
            <div className="app-plan-foot">
              <span>
                Dia {estado.dia} de {DIAS}
              </span>
              <span>{renova(DIAS - estado.dia)}</span>
            </div>
          </div>

          <div className="app-card">
            <div className="app-card-head">
              <span>Consumo do mês</span>
              <strong>{gb(usado)} GB</strong>
            </div>
            <GraficoConsumo historico={estado.historico} />
          </div>

          <div className="app-card">
            <div className="app-card-head">
              <span>Mais usados</span>
            </div>
            <ul className="app-list">
              {APPS.map((app, i) => (
                <AppLinha key={app.nome} app={app} valor={estado.apps[i]!} maior={maior} i={i} />
              ))}
            </ul>
          </div>

          <nav className="app-tabs" aria-hidden="true">
            <span className="active">
              <House />
              Início
            </span>
            <span>
              <BarChart3 />
              Consumo
            </span>
            <span>
              <Wifi />
              Plano
            </span>
            <span>
              <CircleHelp />
              Ajuda
            </span>
          </nav>
        </div>
      </div>
    </div>
  );
}

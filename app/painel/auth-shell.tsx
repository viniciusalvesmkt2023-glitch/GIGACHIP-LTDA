/* eslint-disable @next/next/no-img-element -- logo pequena e estática */
import Link from "next/link";
import { ArrowLeft, BadgeCheck, ClipboardList, FileSpreadsheet, ShieldCheck, Zap } from "lucide-react";
import "./auth.css";

/**
 * Molde das telas de acesso do painel (entrar, 2FA, esqueci a senha, senha nova):
 * formulário no lado branco e painel azul da marca do outro lado (no celular, o azul vem em cima).
 */
const BENEFICIOS = [
  { icon: Zap, text: "Ative linhas em poucos cliques", short: "Ativação rápida" },
  { icon: ClipboardList, text: "Pedidos, pagamentos e contratos num lugar só", short: "Tudo num lugar" },
  { icon: FileSpreadsheet, text: "Planilha do gestor sempre em dia", short: "Planilha em dia" },
  { icon: BadgeCheck, text: "Bloqueios e desbloqueios no tempo certo", short: "Inadimplência" },
];

export function AuthShell({ children, badge = "🔒 ÁREA EXCLUSIVA DA EQUIPE" }: { children: React.ReactNode; badge?: string }) {
  return (
    <main className="au-page">
      <aside className="au-panel">
        <div className="au-texture" aria-hidden="true" />
        <div className="au-lights" aria-hidden="true">
          <span />
          <span />
        </div>
        <div className="au-panel-inner">
          <nav className="au-mobile-nav">
            <img src="/logo-gigachip.png" alt="Gigachip" width={140} height={27} className="au-mobile-logo" />
            <Link href="/" className="au-mobile-back">
              <ArrowLeft size={14} /> Voltar ao site
            </Link>
          </nav>
          <h2>
            A gestão da Gigachip{" "}
            <span>
              em um só lugar
              <svg viewBox="0 0 290 16" aria-hidden="true">
                <path d="M4 11 Q100 0 285 7 M16 15 Q140 5 274 12" />
              </svg>
            </span>
          </h2>
          <ul className="au-benefits">
            {BENEFICIOS.map(({ icon: Icon, text, short }) => (
              <li key={text}>
                <span className="au-benefit-icon">
                  <Icon size={22} />
                </span>
                <span className="au-full">{text}</span>
                <span className="au-short">{short}</span>
              </li>
            ))}
          </ul>
          <section className="au-card">
            <h3>
              <ShieldCheck size={20} /> Acesso só da equipe
            </h3>
            <p>Cada acesso fica registrado e pede o código do celular (verificação em duas etapas). Não compartilhe sua senha.</p>
          </section>
        </div>
      </aside>

      <section className="au-form-side">
        <nav className="au-nav">
          <Link href="/" aria-label="Gigachip — início">
            <img src="/logo-gigachip.png" alt="Gigachip" width={170} height={33} />
          </Link>
          <Link href="/" className="au-back">
            <ArrowLeft size={15} /> Voltar ao site
          </Link>
        </nav>
        <div className="au-form-card">
          <span className="au-badge">{badge}</span>
          {children}
        </div>
        <p className="au-footer">Gigachip Ltda · CNPJ 51.968.628/0001-16</p>
      </section>
    </main>
  );
}

/** Título com a última palavra em degradê azul. */
export function AuthTitle({ before, highlight }: { before: string; highlight?: string }) {
  return (
    <h1 className="au-title">
      {before} {highlight && <span>{highlight}</span>}
    </h1>
  );
}

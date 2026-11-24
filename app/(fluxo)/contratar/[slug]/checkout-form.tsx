"use client";

/* eslint-disable @next/next/no-img-element -- logo pequena e estática */
import { useActionState, useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ChevronDown,
  CreditCard,
  LoaderCircle,
  Lock,
  PhoneCall,
  QrCode,
  ShieldCheck,
  Smartphone,
  Unlock,
  Wifi,
} from "lucide-react";
import { formatBRL } from "@/lib/domain/money";
import { WATCH_TV } from "@/lib/domain/watch-tv";
import { WatchCanaisInfo } from "@/components/site/watch-canais";
import { submitCheckout, type CheckoutFormState } from "../actions";
import { LinhaPedido } from "../../linha-pedido";

/*
 * Contratação em 3 etapas (desenhada no Lovable, inspirada no checkout da Vivo):
 *   1. Seus dados  ·  2. Sua linha (eSIM ou chip físico)  ·  3. Pagamento
 * Tudo num formulário só: as etapas só escondem/mostram partes. O servidor valida tudo de novo
 * (lib/domain/checkout-input.ts) e, se algo voltar com erro, a tela volta para a etapa do campo.
 */

export type CheckoutPlan = {
  slug: string;
  gb: number;
  baseGb: number;
  bonusGb: number;
  priceCents: number;
  allowEsim: boolean;
  allowPhysical: boolean;
};

type Dados = { fullName: string; cpf: string; birthDate: string; phone: string; email: string };
type Chip = "esim" | "physical";
type Metodo = "pix" | "credit_card";

/* ---------------- máscaras e validações (as mesmas regras do servidor) ---------------- */

const digits = (v: string) => v.replace(/\D/g, "");

function maskCpf(v: string) {
  const d = digits(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

/** Vai colocando as barras sozinho: 2 dígitos → "dd/", 4 → "dd/mm/". */
function maskDate(v: string, apagando: boolean) {
  const d = digits(v).slice(0, 8);
  let out = d.slice(0, 2);
  if (d.length > 2 || (d.length === 2 && !apagando)) out += "/";
  out += d.slice(2, 4);
  if (d.length > 4 || (d.length === 4 && !apagando)) out += "/";
  out += d.slice(4, 8);
  return out;
}

function maskPhone(v: string) {
  const d = digits(v).replace(/^55(?=\d{11}$)/, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function cpfValido(v: string) {
  const d = digits(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

function erroData(v: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (!m) return "Digite a data completa (dd/mm/aaaa).";
  const [dd, mm, aaaa] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(aaaa, mm - 1, dd));
  if (d.getUTCFullYear() !== aaaa || d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== dd) return "Data de nascimento inválida.";
  const hoje = new Date();
  let idade = hoje.getFullYear() - aaaa;
  if (hoje.getMonth() + 1 < mm || (hoje.getMonth() + 1 === mm && hoje.getDate() < dd)) idade--;
  if (idade < 18) return "É preciso ter 18 anos ou mais.";
  if (idade >= 120) return "Data de nascimento inválida.";
  return null;
}

function errosDados(v: Dados): Partial<Record<keyof Dados, string>> {
  const e: Partial<Record<keyof Dados, string>> = {};
  if (v.fullName.trim().split(/\s+/).length < 2 || v.fullName.trim().length < 5) e.fullName = "Informe nome e sobrenome.";
  if (!cpfValido(v.cpf)) e.cpf = "CPF inválido.";
  const d = erroData(v.birthDate);
  if (d) e.birthDate = d;
  if (!/^[1-9][1-9]9\d{8}$/.test(digits(v.phone))) e.phone = "Celular inválido. Use DDD + número.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim())) e.email = "E-mail inválido.";
  return e;
}

/** Em qual etapa está cada campo (para voltar nela se o servidor apontar erro). */
const ETAPA_DO_CAMPO: Record<string, number> = {
  fullName: 1, cpf: 1, birthDate: 1, phone: 1, email: 1, planSlug: 1, simType: 2, billingType: 3, whatsappOptIn: 3, form: 3,
};

/* ---------------- peças da tela ---------------- */

const ETAPAS = ["Seus dados", "Sua linha", "Pagamento"];

function Etapas({ atual }: { atual: number }) {
  return (
    <ol className="ck-steps" aria-label="Etapas da contratação">
      {ETAPAS.map((nome, i) => {
        const n = i + 1;
        const estado = n < atual ? "feito" : n === atual ? "atual" : "depois";
        return (
          <li key={nome} className={`ck-step is-${estado}`} aria-current={estado === "atual" ? "step" : undefined}>
            <span className="ck-step-n">{estado === "feito" ? <Check size={14} /> : n}</span>
            <span className="ck-step-label">{nome}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Campo({ label, erro, dica, children, className = "" }: { label: string; erro?: string; dica?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`ck-field ${erro ? "has-error" : ""} ${className}`}>
      <span className="ck-label">
        {label} <span className="ck-req">*</span>
      </span>
      {children}
      {erro ? <span className="ck-error">{erro}</span> : dica ? <span className="ck-hint">{dica}</span> : null}
    </label>
  );
}

function Opcao({ ativo, onClick, icone, titulo, texto, extra }: {
  ativo: boolean; onClick: () => void; icone: ReactNode; titulo: string; texto: string; extra?: ReactNode;
}) {
  return (
    <button type="button" role="radio" aria-checked={ativo} onClick={onClick} className={`ck-option ${ativo ? "is-active" : ""}`}>
      <span className="ck-option-icon">{icone}</span>
      <span className="ck-option-body">
        <strong>{titulo}</strong>
        <span>{texto}</span>
        {extra}
      </span>
      <span className="ck-option-radio" aria-hidden="true" />
    </button>
  );
}

function Resumo({ plan, plans, onTrocar, tv }: { plan: CheckoutPlan; plans: CheckoutPlan[]; onTrocar: (s: string) => void; tv: boolean }) {
  const [aberto, setAberto] = useState(false);
  return (
    <aside className="ck-summary">
      <div className="ck-summary-top">
        <span className="ck-summary-logo">
          <img src="/vivo-logo.png" alt="Rede Vivo" width={84} height={26} />
        </span>
        {plans.length > 1 && (
          <button type="button" className="ck-summary-switch" onClick={() => setAberto((v) => !v)} aria-expanded={aberto}>
            Trocar plano <ChevronDown size={14} className={aberto ? "rotate-180" : ""} />
          </button>
        )}
      </div>
      {aberto && (
        <div className="ck-summary-plans">
          {plans.map((o) => (
            <button
              key={o.slug}
              type="button"
              className={o.slug === plan.slug ? "is-active" : ""}
              onClick={() => {
                onTrocar(o.slug);
                setAberto(false);
              }}
            >
              <span>{o.gb} GB</span>
              <span>{formatBRL(o.priceCents)}/mês</span>
            </button>
          ))}
        </div>
      )}

      <p className="ck-summary-eyebrow">DETALHES DO PEDIDO</p>
      <p className="ck-summary-name">Plano Gigachip {plan.gb} GB</p>
      <div className="ck-summary-main">
        <span className="ck-summary-gb">
          {plan.gb}
          <small>GB</small>
        </span>
        <span className="ck-summary-price">
          {formatBRL(plan.priceCents)}
          <small>/mês</small>
        </span>
      </div>

      <p className="ck-summary-eyebrow">O QUE ESTÁ INCLUSO</p>
      <ul className="ck-summary-list">
        <li>
          <Wifi size={16} /> {plan.bonusGb > 0 ? `${plan.baseGb} GB + ${plan.bonusGb} GB de bônus todo mês` : `${plan.gb} GB todo mês`}
        </li>
        <li>
          <PhoneCall size={16} /> Ligações ilimitadas
        </li>
        <li>
          <Smartphone size={16} /> {plan.allowEsim && plan.allowPhysical ? "eSIM ou chip físico" : plan.allowEsim ? "eSIM" : "Chip físico"}
        </li>
      </ul>
      {tv && (
        <div className="ck-summary-watch">
          <img src="/watch-tv.png" alt="Watch TV" width={44} height={44} />
          <span>
            <span className="ck-summary-watch-top">
              <b>
                + {WATCH_TV.nome}
              </b>
              <strong>+ {formatBRL(WATCH_TV.precoCents)}/mês</strong>
            </span>
            <small>
              Canais ao vivo, filmes e séries em até {WATCH_TV.telas} TVs ao mesmo tempo · IPTV legalizado.
            </small>
            <WatchCanaisInfo tone="white" />
          </span>
        </div>
      )}
      {tv && (
        <p className="ck-summary-total">
          Total por mês <b>{formatBRL(plan.priceCents + WATCH_TV.precoCents)}</b>
        </p>
      )}

      <div className="ck-summary-foot">
        <span>
          <Unlock size={16} /> Sem fidelidade
        </span>
        <span className="ck-toggle" aria-hidden="true">
          <i />
        </span>
      </div>
    </aside>
  );
}

/** Watch TV junto (D44): opcional, começa desmarcada (a não ser que o cliente tenha marcado no plano). */
function WatchBump({ ativo, onChange }: { ativo: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`ck-bump ${ativo ? "is-on" : ""}`}>
      <span className="ck-bump-flag">LEVE JUNTO</span>
      <input type="checkbox" checked={ativo} onChange={(e) => onChange(e.target.checked)} />
      <span className="ck-bump-box" aria-hidden="true">
        <Check size={16} strokeWidth={4} />
      </span>
      <img src="/watch-tv.png" alt="" width={64} height={64} className="ck-bump-logo" />
      <span className="ck-bump-body">
        <span className="ck-bump-title">
          <strong>Sim! Quero a {WATCH_TV.nome} junto com a minha linha</strong>
        </span>
        <span>
          Canais ao vivo, filmes e séries para assistir em até <b>{WATCH_TV.telas} TVs ao mesmo tempo</b>.
        </span>
        <span className="ck-bump-ok">
          <span>✔ IPTV legalizado</span>
          <span>✔ Smart TV, celular e PC</span>
          <span>✔ Cancela quando quiser</span>
        </span>
        <WatchCanaisInfo />
        <span className="ck-bump-price">+ {formatBRL(WATCH_TV.precoCents)}/mês</span>
        <small>Na mesma cobrança da linha. O acesso chega no seu e-mail depois do pagamento.</small>
      </span>
    </label>
  );
}

/* ---------------- formulário ---------------- */

const initial: CheckoutFormState = { errors: {}, values: {} };
const topo = () => window.scrollTo({ top: 0, behavior: "smooth" });

export function CheckoutForm({ plans, initialSlug, initialWatchTv = false }: { plans: CheckoutPlan[]; initialSlug: string; initialWatchTv?: boolean }) {
  const [state, action, pending] = useActionState(submitCheckout, initial);
  const [slug, setSlug] = useState(initialSlug);
  const [etapa, setEtapa] = useState(1);
  const [dados, setDados] = useState<Dados>({ fullName: "", cpf: "", birthDate: "", phone: "", email: "" });
  const [tocados, setTocados] = useState<Partial<Record<keyof Dados, boolean>>>({});
  const [tentou, setTentou] = useState(false);
  const [chip, setChip] = useState<Chip | null>(null);
  const [metodo, setMetodo] = useState<Metodo | null>(null);
  const [whats, setWhats] = useState(true);
  const [tv, setTv] = useState(initialWatchTv);
  const [visto, setVisto] = useState<CheckoutFormState>(initial);

  const plan = plans.find((p) => p.slug === slug) ?? plans[0]!;
  const totalCents = plan.priceCents + (tv ? WATCH_TV.precoCents : 0);
  const chips: Chip[] = [...(plan.allowEsim ? ["esim" as const] : []), ...(plan.allowPhysical ? ["physical" as const] : [])];
  const chipValido = chip && chips.includes(chip) ? chip : chips.length === 1 ? chips[0]! : null;

  // Erro vindo do servidor: volta para a etapa do primeiro campo com problema (uma vez por resposta)
  if (state !== visto) {
    setVisto(state);
    const campos = Object.keys(state.errors);
    if (campos.length) {
      setTentou(true);
      setEtapa(Math.min(...campos.map((c) => ETAPA_DO_CAMPO[c] ?? 3)));
    }
  }
  useEffect(() => {
    if (Object.keys(state.errors).length) topo();
  }, [state]);

  const erros = errosDados(dados);
  const srv = state.errors as Partial<Record<string, string>>;
  const mostra = (k: keyof Dados) => (tentou || tocados[k] ? erros[k] ?? srv[k] : srv[k]);
  const set = (k: keyof Dados, v: string) => setDados((d) => ({ ...d, [k]: v }));
  const toca = (k: keyof Dados) => setTocados((t) => ({ ...t, [k]: true }));
  const primeiroNome = dados.fullName.trim().split(/\s+/)[0];

  function avancarDados() {
    setTentou(true);
    if (Object.keys(erros).length === 0) {
      setTentou(false);
      setEtapa(2);
      topo();
    }
  }

  return (
    <div className="ck-page">
      <div className={`container-site ck-grid ${etapa === 1 ? "" : "is-single"}`}>
        <div className="ck-card">
          <Etapas atual={etapa} />
          {etapa > 1 && (
            <LinhaPedido
              texto={
                tv
                  ? `Plano ${plan.gb} GB + Watch TV · ${formatBRL(totalCents)}/mês · sem fidelidade`
                  : `Plano ${plan.gb} GB · ${formatBRL(plan.priceCents)}/mês · sem fidelidade`
              }
            />
          )}

          {srv.form && (
            <p role="alert" className="ck-alert">
              {srv.form}
            </p>
          )}

          <form
            action={action}
            noValidate
            onSubmit={(e) => {
              if (etapa === 1) {
                e.preventDefault();
                avancarDados();
              } else if (etapa === 2) {
                e.preventDefault();
                if (chipValido) {
                  setEtapa(3);
                  topo();
                }
              } else if (!metodo || !chipValido || Object.keys(erros).length) {
                e.preventDefault();
              }
            }}
          >
            {/* O que vai para o servidor (as etapas só mostram/escondem) */}
            <input type="hidden" name="planSlug" value={plan.slug} />
            <input type="hidden" name="fullName" value={dados.fullName} />
            <input type="hidden" name="cpf" value={dados.cpf} />
            <input type="hidden" name="birthDate" value={dados.birthDate} />
            <input type="hidden" name="phone" value={dados.phone} />
            <input type="hidden" name="email" value={dados.email} />
            <input type="hidden" name="simType" value={chipValido ?? ""} />
            <input type="hidden" name="billingType" value={metodo ?? ""} />
            {whats && <input type="hidden" name="whatsappOptIn" value="on" />}
            {tv && <input type="hidden" name="watchTv" value="on" />}

            {etapa === 1 && (
              <div>
                <p className="ck-kicker">Ótima escolha! Falta pouco para sua linha nova.</p>
                <h1 className="ck-title">Vamos começar seu cadastro</h1>
                <p className="ck-sub">Leva menos de 2 minutos. Seus dados ficam protegidos e só são usados no seu contrato.</p>

                <div className="ck-form">
                  <Campo label="Nome completo" erro={mostra("fullName")} className="ck-span-2">
                    <input
                      className="ck-input"
                      autoComplete="name"
                      placeholder="Como está no seu documento"
                      value={dados.fullName}
                      onChange={(e) => set("fullName", e.target.value)}
                      onBlur={() => toca("fullName")}
                    />
                  </Campo>
                  <Campo label="CPF" erro={mostra("cpf")}>
                    <input
                      className="ck-input"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="000.000.000-00"
                      value={dados.cpf}
                      onChange={(e) => set("cpf", maskCpf(e.target.value))}
                      onBlur={() => toca("cpf")}
                    />
                  </Campo>
                  <Campo label="Data de nascimento" erro={mostra("birthDate")}>
                    <input
                      className="ck-input"
                      inputMode="numeric"
                      autoComplete="bday"
                      placeholder="dd/mm/aaaa"
                      maxLength={10}
                      value={dados.birthDate}
                      onChange={(e) => set("birthDate", maskDate(e.target.value, e.target.value.length < dados.birthDate.length))}
                      onBlur={() => toca("birthDate")}
                    />
                  </Campo>
                  <Campo label="Celular com WhatsApp" erro={mostra("phone")} dica="Seu número atual, para falarmos com você.">
                    <input
                      className="ck-input"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="(00) 90000-0000"
                      value={dados.phone}
                      onChange={(e) => set("phone", maskPhone(e.target.value))}
                      onBlur={() => toca("phone")}
                    />
                  </Campo>
                  <Campo label="E-mail" erro={mostra("email")} dica="O contrato e o número da linha chegam aqui.">
                    <input
                      className="ck-input"
                      type="email"
                      autoComplete="email"
                      placeholder="voce@email.com"
                      value={dados.email}
                      onChange={(e) => set("email", e.target.value)}
                      onBlur={() => toca("email")}
                    />
                  </Campo>
                </div>

                <button type="submit" className="ck-btn">
                  Continuar <ArrowRight size={18} />
                </button>
              </div>
            )}

            {etapa === 2 && (
              <div>
                <p className="ck-kicker">{primeiroNome ? `Prazer, ${primeiroNome}!` : "Quase lá!"}</p>
                <h1 className="ck-title">Como você quer sua linha?</h1>
                <p className="ck-sub">Os dois funcionam igual na rede Vivo. Escolha o que for melhor para o seu celular.</p>

                <div className="ck-options" role="radiogroup" aria-label="Tipo de chip">
                  {plan.allowEsim && (
                    <Opcao
                      ativo={chipValido === "esim"}
                      onClick={() => setChip("esim")}
                      icone={<Smartphone size={22} />}
                      titulo="eSIM (chip digital)"
                      texto="Instalado direto no celular, sem chip de plástico. O aparelho precisa ser compatível com eSIM."
                      extra={
                        chipValido === "esim" && (
                          <span className="ck-next">
                            <Camera size={14} /> Depois do pagamento: um print do <b>registro do eSIM</b> do seu celular (a gente explica como).
                          </span>
                        )
                      }
                    />
                  )}
                  {plan.allowPhysical && (
                    <Opcao
                      ativo={chipValido === "physical"}
                      onClick={() => setChip("physical")}
                      icone={<CreditCard size={22} />}
                      titulo="Chip físico"
                      texto="O cartãozinho tradicional. Use um chip Vivo novo e lacrado."
                      extra={
                        chipValido === "physical" && (
                          <span className="ck-next">
                            <Camera size={14} /> Depois do pagamento: uma foto do <b>verso da embalagem</b> do chip lacrado.
                          </span>
                        )
                      }
                    />
                  )}
                </div>
                {srv.simType && <p className="ck-error">{srv.simType}</p>}

                <div className="ck-actions">
                  <button type="button" className="ck-back" onClick={() => setEtapa(1)}>
                    <ArrowLeft size={16} /> Voltar
                  </button>
                  <button type="submit" className="ck-btn" disabled={!chipValido}>
                    Continuar <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}

            {etapa === 3 && (
              <div>
                <p className="ck-kicker">Última etapa</p>
                <h1 className="ck-title">Como prefere pagar?</h1>
                <p className="ck-sub">A 1ª mensalidade é paga agora. As próximas vencem todo mês no mesmo dia, sem fidelidade.</p>

                <div className="ck-options" role="radiogroup" aria-label="Forma de pagamento">
                  <Opcao
                    ativo={metodo === "pix"}
                    onClick={() => setMetodo("pix")}
                    icone={<QrCode size={22} />}
                    titulo="PIX"
                    texto="Aprovação na hora. Todo mês você recebe um PIX novo para pagar."
                  />
                  <Opcao
                    ativo={metodo === "credit_card"}
                    onClick={() => setMetodo("credit_card")}
                    icone={<CreditCard size={22} />}
                    titulo="Cartão de crédito"
                    texto="Cobrança automática todo mês. Você não precisa se lembrar de pagar."
                  />
                </div>
                {srv.billingType && <p className="ck-error">{srv.billingType}</p>}

                <WatchBump ativo={tv} onChange={setTv} />

                <div className="ck-checks">
                  <label className="ck-check">
                    <input type="checkbox" checked={whats} onChange={(e) => setWhats(e.target.checked)} />
                    <span>Quero receber avisos do pedido pelo WhatsApp.</span>
                  </label>
                </div>

                <div className="ck-actions">
                  <button type="button" className="ck-back" onClick={() => setEtapa(2)} disabled={pending}>
                    <ArrowLeft size={16} /> Voltar
                  </button>
                  <button type="submit" className="ck-btn" disabled={!metodo || pending}>
                    {pending ? (
                      <>
                        <LoaderCircle size={18} className="animate-spin" /> Gerando o pagamento...
                      </>
                    ) : (
                      <>
                        Ir para o pagamento · {formatBRL(totalCents)} <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>

          <p className="ck-trust">
            <Lock size={14} /> Pagamento seguro pelo Asaas · <ShieldCheck size={14} /> Seus dados protegidos
          </p>
        </div>

        {etapa === 1 && <Resumo plan={plan} plans={plans} onTrocar={setSlug} tv={tv} />}
      </div>
    </div>
  );
}

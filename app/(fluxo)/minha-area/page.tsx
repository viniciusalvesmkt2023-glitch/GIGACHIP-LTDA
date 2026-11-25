import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight,
  CircleAlert,
  PhoneCall,
  Receipt,
  Unlock,
  Wifi,
  Check,
  CircleHelp,
  Clock,
  CreditCard,
  FileSignature,
  Lock,
  LogOut,
  MessageCircle,
  Smartphone,
  Tv,
  type LucideIcon,
} from "lucide-react";
import { whatsappLink } from "@/components/whatsapp";
import { formatMsisdn } from "@/lib/domain/lines";
import { currentOrderId } from "@/lib/server/customer-access";
import { getAreaView, getClientDashboard, type AreaView } from "@/lib/server/customer-area";
import { formatBRL } from "@/lib/domain/money";
import { sairAction, trocarPedidoAction } from "./actions";
import { Faturas } from "./faturas";
import { ClienteLogin } from "./entrar/login-form";

export const metadata: Metadata = { title: "Área do Cliente", robots: { index: false } };

/*
 * Área do Cliente (visual do Lovable). O acesso é pelo link pessoal enviado por e-mail (cookie
 * deste navegador). Mostra em que passo o pedido está e leva para o formulário de ativação.
 * Faturas e entrar com código por e-mail ficam para a 2ª fase.
 */

type Estado = "feito" | "agora" | "espera" | "depois";

function Linha({ icon: Icon, titulo, texto, estado }: { icon: LucideIcon; titulo: string; texto: string; estado: Estado }) {
  const rotulo = { feito: "Concluído", agora: "Falta você", espera: "Com a gente", depois: "Próximo passo" }[estado];
  return (
    <li className={`cl-step is-${estado}`}>
      <span className="cl-step-icon">{estado === "feito" ? <Check size={18} strokeWidth={3} /> : <Icon size={18} />}</span>
      <span className="cl-step-body">
        <b>{titulo}</b>
        <small>{texto}</small>
      </span>
      <span className="cl-step-tag">{rotulo}</span>
    </li>
  );
}

function Passos({ v }: { v: AreaView }) {
  const paid = v.paymentStatus === "confirmed" || v.paymentStatus === "received";
  const device = v.deviceStatus === "confirmed";
  const signed = v.contractStatus === "signed";
  const ativo = v.status === "ativado";
  const pronto = ["pronto_para_ativacao", "em_ativacao"].includes(v.status);
  const fisico = v.simType === "physical";
  return (
    <ol className="cl-steps">
      <Linha icon={CreditCard} titulo="Pagamento" texto={paid ? "1ª mensalidade confirmada." : "Aguardando a confirmação do pagamento."} estado={paid ? "feito" : "agora"} />
      <Linha
        icon={Smartphone}
        titulo={fisico ? "Foto do chip" : "Registro do eSIM"}
        texto={device ? "Recebido. Obrigado!" : fisico ? "Envie a foto do verso da embalagem do chip lacrado." : "Envie o print do registro do eSIM (*#06#)."}
        estado={device ? "feito" : paid ? "agora" : "depois"}
      />
      <Linha
        icon={FileSignature}
        titulo="Contrato"
        texto={
          signed
            ? "Contrato assinado."
            : v.contractStatus === "sent"
              ? `Enviado para ${v.emailMasked} pela ${v.plataforma}. Assine com documento e rosto (selfie).`
              : "Chega no seu e-mail depois do registro do chip."
        }
        estado={signed ? "feito" : device && v.contractStatus === "sent" ? "agora" : device ? "espera" : "depois"}
      />
      <Linha
        icon={MessageCircle}
        titulo="Ativação"
        texto={ativo ? "Sua linha está ativa." : pronto ? "Nossa equipe está ativando a sua linha na Vivo." : "Você chama a gente no WhatsApp e recebe o número."}
        estado={ativo ? "feito" : pronto ? "espera" : signed ? "agora" : "depois"}
      />
    </ol>
  );
}

const LINHA: Record<string, { label: string; tone: string }> = {
  ativa: { label: "Linha ativa", tone: "green" },
  suspensao_pendente: { label: "Linha ativa", tone: "green" },
  suspensa: { label: "Linha bloqueada", tone: "red" },
  reativacao_pendente: { label: "Desbloqueando", tone: "amber" },
  cancelamento_pendente: { label: "Cancelando", tone: "gray" },
  cancelada: { label: "Linha cancelada", tone: "gray" },
};
const dataBr = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");

async function Area() {
  const orderId = await currentOrderId();
  const v = orderId ? await getAreaView(orderId) : null;
  if (!v || !orderId) {
    return (
      <>
        <ClienteLogin />
        <p className="text-center">
          <Link href="/planos" className="ac-link">
            Ainda não é cliente? Ver os planos
          </Link>
        </p>
      </>
    );
  }

  const d = await getClientDashboard(orderId);
  const linha = d?.msisdn ? d : null;
  const paid = v.paymentStatus === "confirmed" || v.paymentStatus === "received";
  const ativado = v.status === "ativado";
  const faltaAtivacao = paid && !["ativado", "pronto_para_ativacao", "em_ativacao", "cancelado", "expirado"].includes(v.status);
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const abertas = (d?.faturas ?? []).filter((f) => f.status === "overdue" || (f.status === "pending" && f.dueDate < hoje));
  const suporte = whatsappLink(`Olá! Sou cliente da Gigachip (pedido ${v.code}) e preciso de ajuda.`);
  const ls = linha?.lineStatus ? LINHA[linha.lineStatus] : null;
  const cartao = d?.billingType === "credit_card";

  return (
    <>
      <div className="cl-head">
        <div>
          <p className="ck-kicker">ÁREA DO CLIENTE</p>
          <h1 className="ck-title">Olá, {v.firstName}!</h1>
        </div>
        <form action={sairAction}>
          <button className="cl-sair" type="submit">
            <LogOut size={16} /> Sair
          </button>
        </form>
      </div>

      {abertas.length > 0 && (
        <p className="cl-aviso">
          <CircleAlert size={18} />
          {abertas.length === 1 ? "Você tem 1 fatura vencida." : `Você tem ${abertas.length} faturas vencidas.`} Pague abaixo para
          não ter a linha bloqueada.
        </p>
      )}
      {linha?.lineStatus === "suspensa" && abertas.length === 0 && (
        <p className="cl-aviso is-amber">
          <Clock size={18} /> Recebemos o pagamento. Sua linha será desbloqueada em até 24 horas.
        </p>
      )}

      {/* Meu plano */}
      <section className="cl-plano">
        <div className="cl-plano-top">
          <span className="cl-plano-logo">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo pequena e estática */}
            <img src="/vivo-logo.png" alt="Rede Vivo" width={64} height={20} />
          </span>
          {ls ? <span className={`cl-tag is-${ls.tone}`}>{ls.label}</span> : <span className="cl-tag is-amber">{ativado ? "Linha ativa" : "Em ativação"}</span>}
        </div>
        <p className="cl-plano-nome">{d?.planName ?? v.planName}</p>
        <div className="cl-plano-main">
          <span className="cl-plano-gb">
            {d?.gb ?? "—"}
            <small>GB/mês</small>
          </span>
          <span className="cl-plano-preco">
            {d ? formatBRL(d.monthlyCents) : ""}
            <small>/mês</small>
          </span>
        </div>
        <dl className="cl-plano-dados">
          <div>
            <dt>Número da linha</dt>
            <dd>{linha?.msisdn ? formatMsisdn(linha.msisdn) : "Aparece aqui quando a linha for ativada"}</dd>
          </div>
          <div>
            <dt>Próximo vencimento</dt>
            <dd>{dataBr(d?.nextDueDate ?? null)}</dd>
          </div>
          <div>
            <dt>Pagamento</dt>
            <dd>{cartao ? "Cartão de crédito (automático)" : "PIX todo mês"}</dd>
          </div>
          <div>
            <dt>Chip</dt>
            <dd>{v.simType === "esim" ? "eSIM" : "Chip físico"}</dd>
          </div>
          {d?.watchTv && (
            <div>
              <dt>Watch TV</dt>
              <dd>
                {d.watchTv.status === "ativo"
                  ? "Liberada · o acesso foi para o seu e-mail"
                  : d.watchTv.status === "cancelado"
                    ? "Cancelada"
                    : paid
                      ? "Liberando · o acesso chega no seu e-mail"
                      : "Liberada depois do pagamento"}
              </dd>
            </div>
          )}
        </dl>
        <ul className="cl-plano-inclui">
          <li>
            <Wifi size={15} /> {d?.bonusGb ? `${d.baseGb} GB + ${d.bonusGb} GB de bônus` : `${d?.gb ?? ""} GB`} todo mês
          </li>
          <li>
            <PhoneCall size={15} /> Ligações ilimitadas
          </li>
          <li>
            <Unlock size={15} /> Sem fidelidade
          </li>
          {d?.watchTv && d.watchTv.status !== "cancelado" && (
            <li>
              <Tv size={15} /> Watch TV em até 4 TVs (+ {formatBRL(d.watchTv.cents)})
            </li>
          )}
        </ul>
      </section>

      {!ativado && (
        <>
          <p className="ac-how-title mt-6">Andamento da ativação</p>
          <Passos v={v} />
          {faltaAtivacao && (
            <Link href="/ativacao" className="ck-btn">
              Continuar a ativação <ArrowRight size={18} />
            </Link>
          )}
          {!paid && v.status === "aguardando_pagamento" && (
            <Link href={`/pedido/${orderId}/pagamento`} className="ck-btn">
              Ir para o pagamento <ArrowRight size={18} />
            </Link>
          )}
        </>
      )}

      <p className="ac-how-title mt-6">
        <Receipt size={15} className="mr-1 inline" /> Minhas faturas
      </p>
      <Faturas faturas={d?.faturas ?? []} hoje={hoje} cartao={cartao} />

      {(d?.outrosPedidos.length ?? 0) > 0 && (
        <>
          <p className="ac-how-title mt-6">Suas outras linhas</p>
          <ul className="cl-outros">
            {d!.outrosPedidos.map((p) => (
              <li key={p.id}>
                <form action={trocarPedidoAction}>
                  <input type="hidden" name="pedido" value={p.id} />
                  <button type="submit">
                    <span>
                      <b>Pedido {p.code}</b>
                      <small>{p.planName}</small>
                    </span>
                    <ArrowRight size={16} />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}

      {suporte && (
        <a href={suporte} target="_blank" rel="noopener noreferrer" className="cl-help">
          <CircleHelp size={18} /> Precisa de ajuda? Fale com a gente no WhatsApp
        </a>
      )}
    </>
  );
}

export default function MinhaAreaPage() {
  return (
    <div className="ck-page">
      <div className="container-site ck-grid is-single">
        <div className="ck-card">
          <Suspense fallback={<div style={{ minHeight: 420 }} />}>
            <Area />
          </Suspense>
          <p className="ck-trust">
            <Lock size={14} /> Acesso pessoal · não compartilhe o código nem o link
          </p>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight,
  Check,
  CircleHelp,
  Clock,
  CreditCard,
  FileSignature,
  Lock,
  LogOut,
  Mail,
  MessageCircle,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { whatsappLink } from "@/components/whatsapp";
import { formatMsisdn } from "@/lib/domain/lines";
import { currentOrderId } from "@/lib/server/customer-access";
import { getAreaView, type AreaView } from "@/lib/server/customer-area";
import { lineForOrder } from "@/lib/server/lines";
import { LinhaPedido } from "../linha-pedido";
import { sairAction } from "./actions";

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
              ? `Enviado para ${v.emailMasked} pela D4Sign. Assine com documento e selfie.`
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

async function Area({ searchParams }: { searchParams: PageProps<"/minha-area">["searchParams"] }) {
  const sp = await searchParams;
  const orderId = await currentOrderId();
  const v = orderId ? await getAreaView(orderId) : null;
  const ajuda = whatsappLink("Olá! Preciso de ajuda para acessar a Área do Cliente da Gigachip.");

  if (!v || !orderId) {
    return (
      <div className="cl-empty">
        <span className="cl-empty-icon">
          <Mail size={26} />
        </span>
        <p className="ck-kicker">ÁREA DO CLIENTE</p>
        <h1 className="ck-title">Acesse pelo link do seu e-mail</h1>
        <p className="ck-sub ac-sub-big">
          {sp.link === "invalido"
            ? "Este link expirou ou não é válido. Abra o e-mail mais recente da Gigachip ou fale com a gente."
            : "Depois do pagamento, mandamos um e-mail com o seu link pessoal. É só abrir por ele — não precisa de senha."}
        </p>
        <p className="ac-wait">
          <Clock size={15} /> Não achou? Confira o spam ou a aba Promoções.
        </p>
        {ajuda && (
          <a href={ajuda} target="_blank" rel="noopener noreferrer" className="ck-btn">
            <MessageCircle size={18} /> Falar com a gente no WhatsApp
          </a>
        )}
        <Link href="/planos" className="ac-link">
          Ainda não é cliente? Ver os planos
        </Link>
      </div>
    );
  }

  const linha = v.status === "ativado" ? await lineForOrder(orderId) : null;
  const paid = v.paymentStatus === "confirmed" || v.paymentStatus === "received";
  const faltaAtivacao = paid && !["ativado", "pronto_para_ativacao", "em_ativacao", "cancelado", "expirado"].includes(v.status);
  const gb = /(\d+)\s*GB/i.exec(v.planName)?.[1];
  const suporte = whatsappLink(`Olá! Sou cliente da Gigachip (pedido ${v.code}) e preciso de ajuda.`);

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
      <LinhaPedido texto={`Pedido ${v.code} · ${gb ? `Plano ${gb} GB` : v.planName} · ${v.simType === "esim" ? "eSIM" : "Chip físico"}`} />

      {v.status === "ativado" && (
        <div className="cl-ativa">
          <span>
            <Check size={22} strokeWidth={3} />
          </span>
          <div>
            <b>Sua linha está ativa!</b>
            <small>{linha ? <>Número: <strong>{formatMsisdn(linha.msisdn)}</strong></> : "O número foi enviado para o seu e-mail."}</small>
          </div>
        </div>
      )}

      <p className="ac-how-title mt-6">Andamento do pedido</p>
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

      {suporte && (
        <a href={suporte} target="_blank" rel="noopener noreferrer" className="cl-help">
          <CircleHelp size={18} /> Precisa de ajuda? Fale com a gente no WhatsApp
        </a>
      )}
    </>
  );
}

export default function MinhaAreaPage({ searchParams }: PageProps<"/minha-area">) {
  return (
    <div className="ck-page">
      <div className="container-site ck-grid is-single">
        <div className="ck-card">
          <Suspense fallback={<div style={{ minHeight: 420 }} />}>
            <Area searchParams={searchParams} />
          </Suspense>
          <p className="ck-trust">
            <Lock size={14} /> Acesso pessoal pelo link do e-mail · não compartilhe
          </p>
        </div>
      </div>
    </div>
  );
}

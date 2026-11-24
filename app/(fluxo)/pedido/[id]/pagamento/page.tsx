import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  CreditCard,
  ExternalLink,
  FileSignature,
  Lock,
  MessageCircle,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
} from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { whatsappLink } from "@/components/whatsapp";
import { formatBRL } from "@/lib/domain/money";
import { asaas, AsaasError } from "@/lib/integrations/asaas/client";
import { getPaymentView, type PaymentView } from "@/lib/server/payments";
import { LinhaPedido } from "../../../linha-pedido";
import { CopyButton, PaymentStatusWatcher } from "./payment-status";

export const metadata: Metadata = { title: "Pagamento", robots: { index: false } };

/*
 * Pagamento (desenhado no Lovable). A confirmação NUNCA vem desta tela: só do webhook do Asaas
 * (a tela só consulta o status e avança sozinha quando o pagamento é confirmado).
 */

async function Pix({ paymentId, invoiceUrl }: { paymentId: string; invoiceUrl: string | null }) {
  const qr = await asaas.getPixQrCode(paymentId).catch((err: unknown) => {
    // Sem dados pessoais no log: só o id da cobrança e o erro do Asaas
    const detail = err instanceof AsaasError ? `${err.status} ${JSON.stringify(err.errors)}` : String(err);
    console.error(`[pagamento] QR Code PIX indisponível para ${paymentId}: ${detail}`);
    return null;
  });
  if (!qr) {
    return (
      <div className="pg-pix-wrap">
        <p className="ck-sub">
          Não conseguimos mostrar o QR Code aqui agora. Você pode pagar pela página segura do Asaas, nosso parceiro de pagamentos.
        </p>
        {invoiceUrl && (
          <a href={invoiceUrl} target="_blank" rel="noopener noreferrer" className="ck-btn">
            Abrir página de pagamento <ExternalLink size={18} />
          </a>
        )}
        <p className="pg-wait">
          <span className="pg-wait-dot" /> Tentando carregar o QR Code de novo…
        </p>
        {/* O Asaas às vezes demora para gerar o QR Code da cobrança nova: tenta de novo sozinho */}
        <AutoRefresh seconds={8} />
      </div>
    );
  }
  return (
    <div className="pg-pix-wrap">
      <div className="pg-pix">
        <div className="pg-qr">
          {/* eslint-disable-next-line @next/next/no-img-element -- imagem base64 gerada pelo Asaas */}
          <img src={`data:image/png;base64,${qr.encodedImage}`} alt="QR Code do Pix" width={190} height={190} className="pg-qr-img" />
          <span>
            <ScanLine size={14} /> Escaneie com o app do banco
          </span>
        </div>
        <div className="pg-pix-side">
          <p className="ac-how-title">Como pagar</p>
          <ol className="pg-steps">
            <li>
              <span className="ac-how-n">1</span>
              <span>
                Abra o <b>app do seu banco</b> e entre na área <b>Pix</b>.
              </span>
            </li>
            <li>
              <span className="ac-how-n">2</span>
              <span>
                Escolha <b>“Ler QR Code”</b> e aponte a câmera para o QR Code, ou <b>“Pix copia e cola”</b> e cole o código copiado.
              </span>
            </li>
            <li>
              <span className="ac-how-n">3</span>
              <span>
                Confira o valor e o nome <b>Gigachip Ltda</b> e confirme.
              </span>
            </li>
          </ol>
        </div>
      </div>
      <div className="pg-copy">
        <span className="pg-copy-label">Pix copia e cola</span>
        <code>{qr.payload}</code>
        <CopyButton text={qr.payload} />
      </div>
    </div>
  );
}

function Cartao({ invoiceUrl }: { invoiceUrl: string | null }) {
  return (
    <>
      <div className="pg-card">
        <div className="pg-card-art" aria-hidden="true">
          <span className="pg-card-chip" />
          <span className="pg-card-num">•••• •••• •••• ••••</span>
          <span className="pg-card-brand">
            <CreditCard size={22} />
          </span>
        </div>
        <ul className="pg-card-list">
          <li>
            <Lock size={16} /> Pagamento com criptografia, igual ao das lojas grandes
          </li>
          <li>
            <RefreshCw size={16} /> Cobrança automática todo mês — você não precisa lembrar
          </li>
          <li>
            <ShieldCheck size={16} /> Sem fidelidade: cancele quando quiser
          </li>
        </ul>
      </div>
      {invoiceUrl && (
        <a href={invoiceUrl} target="_blank" rel="noopener noreferrer" className="ck-btn">
          <Lock size={18} /> Pagar com cartão <ArrowRight size={18} />
        </a>
      )}
      <p className="pg-brands">Visa · Mastercard · Elo · Hipercard · American Express</p>
    </>
  );
}

function Pago({ view }: { view: PaymentView }) {
  const fisico = view.simType === "physical";
  return (
    <div className="pg-done">
      <span className="pg-done-check">
        <Check size={44} strokeWidth={3} />
      </span>
      <p className="ck-kicker">Pagamento confirmado ✓</p>
      <h1 className="ck-title">🎉 Parabéns! Sua linha nova está a caminho</h1>
      <p className="ck-sub ac-sub-big">
        Agora faltam 2 passos rápidos para a gente ativar a sua linha. Mandamos também um e-mail com o link, caso queira fazer
        depois.
      </p>
      <ol className="pg-next">
        <li>
          <span className="pg-next-icon">{fisico ? <CreditCard size={20} /> : <Smartphone size={20} />}</span>
          <span>
            <b>{fisico ? "Foto do chip" : "Registro do eSIM"}</b>
            <small>{fisico ? "Uma foto do verso da embalagem" : "Um print com os números do celular"}</small>
          </span>
        </li>
        <li>
          <span className="pg-next-icon">
            <FileSignature size={20} />
          </span>
          <span>
            <b>Contrato no e-mail</b>
            <small>Documento e selfie, pela D4Sign</small>
          </span>
        </li>
        <li>
          <span className="pg-next-icon">
            <MessageCircle size={20} />
          </span>
          <span>
            <b>Ativação</b>
            <small>Você chama a gente no WhatsApp e recebe o número</small>
          </span>
        </li>
      </ol>
      <Link href="/ativacao" className="ck-btn">
        Continuar para a ativação <ArrowRight size={18} />
      </Link>
    </div>
  );
}

async function Payment({ params }: { params: PageProps<"/pedido/[id]/pagamento">["params"] }) {
  const { id } = await params;
  const view = await getPaymentView(id);
  if (!view) notFound();

  const wa = whatsappLink(`Olá! Tenho uma dúvida sobre o pagamento do pedido ${view.orderCode}.`);
  const waiting = view.status === "aguardando_pagamento";
  const expired = view.status === "expirado" || view.status === "cancelado";
  const cartao = view.billingType === "credit_card";
  const gb = /(\d+)\s*GB/i.exec(view.planName)?.[1];

  return (
    <div className="ck-page">
      <div className="container-site ck-grid is-single">
        <div className="ck-card">
          <LinhaPedido texto={`Pedido ${view.orderCode} · ${gb ? `Plano ${gb} GB` : view.planName}${view.watchTvCents ? " + Watch TV" : ""} · Total hoje ${formatBRL(view.amountCents)}`} />

          {expired && (
            <>
              <h1 className="ck-title">Este pedido expirou</h1>
              <p className="ck-alert">
                <TriangleAlert size={16} className="mr-1 inline" /> O pagamento não foi feito no prazo. Faça uma nova contratação.
              </p>
              <Link href="/planos" className="ck-btn">
                Ver os planos <ArrowRight size={18} />
              </Link>
            </>
          )}

          {waiting && (
            <div>
              <p className="ck-kicker">Falta só o pagamento</p>
              <h1 className="ck-title">{cartao ? "Pague com cartão de crédito" : "Pague com PIX"}</h1>
              <p className="ck-sub ac-sub-big">
                {cartao ? (
                  <>
                    Você vai para a página segura do <b>Asaas</b>, nosso parceiro de pagamentos. Os dados do cartão não passam pelo site
                    da Gigachip.
                  </>
                ) : (
                  "Aprovação na hora. Assim que o Pix cair, esta página avança sozinha."
                )}
              </p>
              {view.providerPaymentId ? (
                cartao ? (
                  <Cartao invoiceUrl={view.invoiceUrl} />
                ) : (
                  <Suspense fallback={<div className="pg-pix-wrap" style={{ minHeight: 320 }} />}>
                    <Pix paymentId={view.providerPaymentId} invoiceUrl={view.invoiceUrl} />
                  </Suspense>
                )
              ) : (
                <p className="pg-wait">
                  <span className="pg-wait-dot" /> Preparando a cobrança…
                </p>
              )}
            </div>
          )}

          {!waiting && !expired && <Pago view={view} />}

          <PaymentStatusWatcher
            orderId={id}
            initialStatus={view.status}
            texto={cartao ? "Depois de pagar, volte para esta aba: ela avança sozinha." : "Aguardando o pagamento… não precisa atualizar a página."}
          />

          {wa && (
            <p className="pg-help">
              Dúvidas?{" "}
              <a href={wa} target="_blank" rel="noopener noreferrer">
                Fale com a gente no WhatsApp
              </a>
            </p>
          )}
          <p className="ck-trust">
            <Building2 size={14} /> Gigachip Ltda · CNPJ 51.968.628/0001-16 · <QrCode size={14} /> pagamentos pelo Asaas
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PagamentoPage({ params }: PageProps<"/pedido/[id]/pagamento">) {
  return (
    <Suspense fallback={<div className="ck-page" style={{ minHeight: 700 }} />}>
      <Payment params={params} />
    </Suspense>
  );
}

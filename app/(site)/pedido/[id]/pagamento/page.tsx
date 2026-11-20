import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Container, buttonStyles } from "@/components/ui";
import { whatsappLink } from "@/components/whatsapp";
import { formatBRL } from "@/lib/domain/money";
import { asaas, AsaasError } from "@/lib/integrations/asaas/client";
import { getPaymentView, type PaymentView } from "@/lib/server/payments";
import { CopyButton, PaymentStatusWatcher } from "./payment-status";

export const metadata: Metadata = { title: "Pagamento", robots: { index: false } };

async function PixBox({ paymentId, invoiceUrl }: { paymentId: string; invoiceUrl: string | null }) {
  const qr = await asaas.getPixQrCode(paymentId).catch((err: unknown) => {
    // Sem dados pessoais no log: só o id da cobrança e o erro do Asaas
    const detail = err instanceof AsaasError ? `${err.status} ${JSON.stringify(err.errors)}` : String(err);
    console.error(`[pagamento] QR Code PIX indisponível para ${paymentId}: ${detail}`);
    return null;
  });
  if (!qr) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted">
          Não conseguimos mostrar o QR Code aqui agora. Você pode pagar pela página segura do Asaas, nosso parceiro de
          pagamentos:
        </p>
        {invoiceUrl && (
          <a href={invoiceUrl} target="_blank" rel="noopener noreferrer" className={`${buttonStyles.primary} w-full`}>
            Abrir página de pagamento
          </a>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-4 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- imagem base64 gerada pelo Asaas */}
      <img src={`data:image/png;base64,${qr.encodedImage}`} alt="QR Code PIX" className="mx-auto h-56 w-56" />
      <p className="text-sm text-muted">Abra o app do seu banco, escolha PIX e escaneie o QR Code — ou copie o código:</p>
      <p className="break-all rounded-xl bg-surface p-3 font-mono text-xs">{qr.payload}</p>
      <CopyButton text={qr.payload} />
    </div>
  );
}

function Paid({ view }: { view: PaymentView }) {
  return (
    <div className="rounded-2xl border border-success bg-green-50 p-6 text-center">
      <p className="text-4xl" aria-hidden>🎉</p>
      <p className="mt-2 text-2xl font-bold text-success">Parabéns! Sua linha foi contratada.</p>
      <p className="mt-3 text-sm leading-relaxed">
        Pagamento confirmado. Falta só um passo para ativarmos sua linha: preencher o formulário de ativação.
        Leva poucos minutos.
      </p>
      <a href="/ativacao" className={`${buttonStyles.primary} mt-6 w-full py-4 text-base`}>
        Próximo passo: formulário de ativação
      </a>
      <p className="mt-4 text-xs text-muted">Pedido {view.orderCode}. O link do formulário também chega no seu e-mail.</p>
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

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <p className="text-sm text-muted">Pedido {view.orderCode}</p>
        <h1 className="text-2xl font-bold">{view.planName}</h1>
        <p className="text-muted">1ª mensalidade: <strong className="text-foreground">{formatBRL(view.amountCents)}</strong></p>
      </div>

      {expired && (
        <p className="rounded-xl border border-danger bg-red-50 p-4 text-sm text-danger">
          Este pedido expirou sem pagamento. Faça uma nova contratação.
        </p>
      )}

      {waiting && view.providerPaymentId && (
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          {view.billingType === "credit_card" ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted">
                O pagamento com cartão é feito na página segura do Asaas, nosso parceiro de pagamentos. Os dados do
                cartão não passam pelo nosso site.
              </p>
              {view.invoiceUrl && (
                <a href={view.invoiceUrl} target="_blank" rel="noopener noreferrer" className={`${buttonStyles.primary} w-full`}>
                  Pagar com cartão
                </a>
              )}
            </div>
          ) : (
            <Suspense fallback={<div className="mx-auto h-56 w-56 animate-pulse rounded-xl bg-surface" />}>
              <PixBox paymentId={view.providerPaymentId} invoiceUrl={view.invoiceUrl} />
            </Suspense>
          )}
        </div>
      )}

      {!waiting && !expired && <Paid view={view} />}

      <PaymentStatusWatcher orderId={id} initialStatus={view.status} />

      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" className={`${buttonStyles.secondary} w-full`}>
          Dúvidas? Fale no WhatsApp
        </a>
      )}
    </div>
  );
}

export default function PagamentoPage({ params }: PageProps<"/pedido/[id]/pagamento">) {
  return (
    <Container className="py-12">
      <Suspense fallback={<div className="mx-auto h-96 max-w-lg animate-pulse rounded-2xl bg-surface" />}>
        <Payment params={params} />
      </Suspense>
    </Container>
  );
}

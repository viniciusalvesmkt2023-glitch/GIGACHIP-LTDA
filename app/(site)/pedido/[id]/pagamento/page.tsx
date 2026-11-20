import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Container, buttonStyles } from "@/components/ui";
import { whatsappLink } from "@/components/whatsapp";
import { formatBRL } from "@/lib/domain/money";
import { asaas } from "@/lib/integrations/asaas/client";
import { getPaymentView, type PaymentView } from "@/lib/server/payments";
import { CopyButton, PaymentStatusWatcher } from "./payment-status";

export const metadata: Metadata = { title: "Pagamento", robots: { index: false } };

async function PixBox({ paymentId }: { paymentId: string }) {
  const qr = await asaas.getPixQrCode(paymentId).catch(() => null);
  if (!qr) {
    return <p className="text-sm text-danger">Não foi possível carregar o QR Code. Atualize a página em instantes.</p>;
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
    <div className="rounded-2xl border border-success bg-green-50 p-6">
      <p className="text-xl font-bold text-success">Pagamento confirmado!</p>
      <p className="mt-2 text-sm">
        Enviamos para o seu e-mail o link da sua área segura, onde você vai concluir a ativação:
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
        <li>Confirmar sua identidade (documento + selfie)</li>
        <li>Assinar o contrato digital</li>
        <li>Informar os dados do aparelho/chip (IMEI e EID ou número do chip)</li>
      </ol>
      <p className="mt-4 text-xs text-muted">Número do pedido: {view.orderCode}</p>
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
              <PixBox paymentId={view.providerPaymentId} />
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

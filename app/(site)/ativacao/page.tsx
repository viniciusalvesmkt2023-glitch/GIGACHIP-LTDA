import type { Metadata } from "next";
import { Suspense } from "react";
import { Container, buttonStyles } from "@/components/ui";
import { whatsappLink } from "@/components/whatsapp";
import { currentOrderId } from "@/lib/server/customer-access";
import { deviceForWhatsapp, getAreaView } from "@/lib/server/customer-area";
import { getIdentityReview } from "@/lib/server/identity";
import { identityMode } from "@/lib/server/identity-mode";
import { IdentityForm } from "../minha-area/identidade/identity-form";
import { DeviceActivationForm } from "./device-activation-form";
import { RefreshWhileWaiting } from "./refresh-while-waiting";

export const metadata: Metadata = { title: "Formulário de ativação", robots: { index: false } };

function Section({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-white p-5">
      <div className="flex items-center gap-3">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${done ? "bg-success text-white" : "bg-brand-soft text-brand"}`}>
          {done ? "✓" : n}
        </span>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/ativacao">["searchParams"] }) {
  const sp = await searchParams;
  const orderId = await currentOrderId();
  const v = orderId ? await getAreaView(orderId) : null;
  if (!v || !orderId) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border p-6 text-center">
        <h1 className="text-2xl font-bold">Formulário de ativação</h1>
        <p className="mt-3 text-muted">
          {sp.link === "invalido" ? "Este link expirou ou não é válido." : "Abra o link do formulário que enviamos para o seu e-mail."}
        </p>
      </div>
    );
  }

  const paid = v.paymentStatus === "confirmed" || v.paymentStatus === "received";
  const deviceDone = v.deviceStatus === "confirmed";
  const signed = v.contractStatus === "signed";
  const manualIdentity = identityMode() === "manual";
  const identityDone = ["in_review", "approved"].includes(v.identityStatus);
  const canSendIdentity = v.status === "em_andamento" && ["not_started", "pending_documents", "retry_required"].includes(v.identityStatus);
  const review = manualIdentity && v.identityStatus === "retry_required" ? await getIdentityReview(orderId) : null;
  // D28: 1) ID do celular → 2) assinar o contrato (com documento + selfie) → 3) chamar no WhatsApp
  const readyForWhatsapp = deviceDone && signed && (manualIdentity ? identityDone : true);
  const device = readyForWhatsapp ? await deviceForWhatsapp(orderId) : null;
  const waMessage = [
    "Olá! Quero ativar minha linha Gigachip.",
    `Pedido: ${v.code}`,
    `Nome: ${v.fullName}`,
    `Plano: ${v.planName} (${v.simType === "esim" ? "eSIM" : "chip físico"})`,
    device ? `IMEI: ${device.imei}` : null,
    device?.eid ? `EID: ${device.eid}` : null,
    device?.iccid ? `ICCID: ${device.iccid}` : null,
    "Contrato assinado ✅",
  ].filter(Boolean).join("\n");
  const wa = whatsappLink(waMessage);
  const contractStep = manualIdentity ? 3 : 2;

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <p className="text-sm text-muted">Pedido {v.code} · {v.planName} · {v.simType === "esim" ? "eSIM" : "Chip físico"}</p>
        <h1 className="text-3xl font-bold">Formulário de ativação</h1>
        <p className="mt-1 text-muted">Olá, {v.firstName}! Siga os passos abaixo para ativarmos sua linha.</p>
      </div>

      {!paid && <p className="rounded-xl bg-amber-50 p-4 text-sm">Assim que o pagamento for confirmado, este formulário é liberado.</p>}

      {paid && (
        <>
          <Section n={1} title="Envie o ID do celular" done={deviceDone}>
            {deviceDone ? (
              <p className="text-sm text-muted">Recebido (IMEI final {v.imeiLast4}). Obrigado!</p>
            ) : v.status === "em_andamento" || v.status === "pendencia" ? (
              <DeviceActivationForm simType={v.simType} />
            ) : (
              <p className="text-sm text-muted">Esta etapa não está disponível agora.</p>
            )}
          </Section>

          {manualIdentity && (
            <Section n={2} title="Documento e selfie" done={identityDone}>
              {review?.rejectionReason && (
                <p className="mb-4 rounded-xl border border-accent bg-amber-50 p-3 text-sm"><strong>Precisamos de novas fotos:</strong> {review.rejectionReason}</p>
              )}
              {identityDone ? (
                <p className="text-sm text-muted">{v.identityStatus === "approved" ? "Identidade confirmada." : "Recebemos suas fotos. Nossa equipe está conferindo."}</p>
              ) : canSendIdentity ? (
                <IdentityForm redirectTo="/ativacao" />
              ) : (
                <p className="text-sm text-muted">Esta etapa não está disponível agora.</p>
              )}
            </Section>
          )}

          <Section n={contractStep} title="Assine o contrato no seu e-mail" done={signed}>
            {signed ? (
              <p className="text-sm text-muted">Contrato assinado. Obrigado!</p>
            ) : !deviceDone ? (
              <p className="text-sm text-muted">Disponível depois que você enviar o ID do celular.</p>
            ) : (
              <div className="space-y-3 text-sm">
                <p>
                  {v.contractStatus === "sent"
                    ? "Enviamos o contrato para o seu e-mail pela D4Sign, nossa plataforma de assinatura digital. Abra o e-mail (confira também o spam) e assine."
                    : "Estamos preparando o seu contrato. Ele chega no seu e-mail pela D4Sign em instantes."}
                </p>
                {!manualIdentity && (
                  <p className="rounded-xl bg-surface p-3">
                    🪪 Para assinar, a D4Sign vai pedir uma <strong>foto do seu documento (RG ou CNH)</strong> e uma <strong>selfie</strong>. Tenha o documento em mãos.
                  </p>
                )}
                <p className="text-xs text-muted">Depois de assinar, volte para esta página — ela atualiza sozinha.</p>
                <RefreshWhileWaiting />
              </div>
            )}
          </Section>

          <Section n={contractStep + 1} title="Chame a gente no WhatsApp" done={false}>
            {readyForWhatsapp ? (
              <div className="space-y-3 text-sm">
                <p>Tudo certo! Toque no botão para nos enviar seus dados pelo WhatsApp. Nossa equipe ativa sua linha e fala com você.</p>
                {wa ? (
                  <a href={wa} target="_blank" rel="noopener noreferrer" className={`${buttonStyles.whatsapp} w-full py-4 text-base`}>
                    Enviar dados e pedir ativação no WhatsApp
                  </a>
                ) : (
                  <p className="rounded-xl bg-amber-50 p-3">Nosso WhatsApp será informado aqui em breve. Seu pedido já está na fila de ativação.</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted">Disponível depois que o contrato for assinado.</p>
            )}
          </Section>
        </>
      )}

      <p className="text-xs text-muted">
        Seus dados e imagens são enviados direto para a nossa área segura, guardados de forma criptografada e vistos só pela
        equipe autorizada. Nunca pedimos documentos por e-mail ou WhatsApp.
      </p>
    </div>
  );
}

export default function AtivacaoPage({ searchParams }: PageProps<"/ativacao">) {
  return (
    <Container className="py-10">
      <Suspense fallback={<div className="mx-auto h-96 max-w-lg animate-pulse rounded-2xl bg-surface" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

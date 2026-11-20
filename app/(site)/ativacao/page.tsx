import type { Metadata } from "next";
import { Suspense } from "react";
import { Container, buttonStyles } from "@/components/ui";
import { whatsappLink } from "@/components/whatsapp";
import { currentOrderId } from "@/lib/server/customer-access";
import { getAreaView } from "@/lib/server/customer-area";
import { getIdentityReview } from "@/lib/server/identity";
import { IdentityForm } from "../minha-area/identidade/identity-form";
import { DeviceActivationForm } from "./device-activation-form";

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
  const identityDone = ["in_review", "approved"].includes(v.identityStatus);
  const canSendIdentity = v.status === "em_andamento" && ["not_started", "pending_documents", "retry_required"].includes(v.identityStatus);
  const review = v.identityStatus === "retry_required" ? await getIdentityReview(orderId) : null;
  const allSent = deviceDone && identityDone;
  const wa = whatsappLink(`Olá! Enviei o formulário de ativação do pedido ${v.code}.`);

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <p className="text-sm text-muted">Pedido {v.code} · {v.planName} · {v.simType === "esim" ? "eSIM" : "Chip físico"}</p>
        <h1 className="text-3xl font-bold">Formulário de ativação</h1>
        <p className="mt-1 text-muted">Olá, {v.firstName}! Faltam só estes passos para ativarmos sua linha.</p>
      </div>

      {!paid && <p className="rounded-xl bg-amber-50 p-4 text-sm">Assim que o pagamento for confirmado, este formulário é liberado.</p>}

      {allSent && (
        <div className="rounded-2xl border border-success bg-green-50 p-5">
          <p className="text-lg font-bold text-success">Recebemos tudo!</p>
          <p className="mt-1 text-sm">
            {v.contractStatus === "signed"
              ? "Seu contrato está assinado. Nossa equipe vai conferir os dados e ativar sua linha."
              : "Falta só assinar o contrato que enviamos para o seu e-mail pela D4Sign."}
          </p>
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className={`${buttonStyles.whatsapp} mt-3`}>Falar no WhatsApp</a>}
        </div>
      )}

      {paid && (
        <>
          <Section n={1} title="Dados do celular" done={deviceDone}>
            {deviceDone ? (
              <p className="text-sm text-muted">Recebido (IMEI final {v.imeiLast4}). Obrigado!</p>
            ) : v.status === "em_andamento" || v.status === "pendencia" ? (
              <DeviceActivationForm simType={v.simType} />
            ) : (
              <p className="text-sm text-muted">Esta etapa não está disponível agora.</p>
            )}
          </Section>

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

          <Section n={3} title="Assinar o contrato" done={v.contractStatus === "signed"}>
            <p className="text-sm text-muted">
              {v.contractStatus === "signed"
                ? "Contrato assinado. Obrigado!"
                : v.contractStatus === "sent"
                  ? "Enviamos o contrato para o seu e-mail pela D4Sign. Procure o e-mail da D4Sign (confira também o spam) e assine."
                  : "Estamos preparando o seu contrato. Ele chega no seu e-mail pela D4Sign em instantes."}
            </p>
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

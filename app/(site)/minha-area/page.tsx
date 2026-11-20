import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Container, buttonStyles } from "@/components/ui";
import { whatsappLink } from "@/components/whatsapp";
import { currentOrderId } from "@/lib/server/customer-access";
import { getAreaView, type AreaView } from "@/lib/server/customer-area";

export const metadata: Metadata = { title: "Minha área", robots: { index: false } };

type StepState = "feito" | "pendente" | "bloqueado" | "analise" | "problema";

function Step({ n, title, text, state, action }: { n: number; title: string; text: string; state: StepState; action?: React.ReactNode }) {
  const badge: Record<StepState, [string, string]> = {
    feito: ["Concluído", "bg-green-100 text-success"],
    pendente: ["Pendente", "bg-amber-100 text-amber-800"],
    analise: ["Em análise", "bg-sky-100 text-sky-800"],
    bloqueado: ["Aguardando etapa anterior", "bg-surface text-muted"],
    problema: ["Precisa de atenção", "bg-red-100 text-danger"],
  };
  const [label, cls] = badge[state];
  return (
    <li className="flex gap-4 rounded-2xl border border-border bg-white p-5">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${state === "feito" ? "bg-success text-white" : "bg-brand-soft text-brand"}`}>
        {state === "feito" ? "✓" : n}
      </span>
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{title}</p>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>
        </div>
        <p className="mt-1 text-sm text-muted">{text}</p>
        {action && <div className="mt-3">{action}</div>}
      </div>
    </li>
  );
}

function identityState(s: string): StepState {
  if (s === "approved") return "feito";
  if (s === "in_review") return "analise";
  if (s === "rejected" || s === "retry_required") return "problema";
  return "pendente";
}

function Checklist({ v }: { v: AreaView }) {
  const paid = v.paymentStatus === "confirmed" || v.paymentStatus === "received";
  const deviceLabel = v.simType === "esim" ? "IMEI e EID" : "IMEI e número do chip (ICCID)";
  const ready = ["pronto_para_ativacao", "em_ativacao"].includes(v.status);
  const wa = whatsappLink(`Olá! Concluí o cadastro do pedido ${v.code} e quero solicitar a ativação.`);

  if (v.status === "ativado") {
    return (
      <div className="rounded-2xl border border-success bg-green-50 p-6">
        <p className="text-xl font-bold text-success">Sua linha está ativa!</p>
        <p className="mt-2 text-sm">As orientações de uso foram enviadas para o seu e-mail.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {ready && (
        <div className="rounded-2xl border border-success bg-green-50 p-6">
          <p className="text-xl font-bold text-success">Tudo pronto para a ativação!</p>
          <p className="mt-2 text-sm">Recebemos todos os seus dados. Nossa equipe vai ativar sua linha e avisar você.</p>
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className={`${buttonStyles.whatsapp} mt-4`}>
              Solicitar ativação pelo WhatsApp
            </a>
          )}
        </div>
      )}
      <ol className="space-y-3">
        <Step n={1} title="Pagamento" text={paid ? "1ª mensalidade confirmada." : "Aguardando a confirmação do pagamento."} state={paid ? "feito" : "pendente"} />
        <Step
          n={2}
          title="Confirmar identidade"
          text="Envie uma foto do documento (RG ou CNH) e uma selfie. Tudo pela área segura, nunca por e-mail."
          state={paid ? identityState(v.identityStatus) : "bloqueado"}
          action={
            paid && ["not_started", "pending_documents", "retry_required"].includes(v.identityStatus) ? (
              <Link href="/minha-area/identidade" className={`${buttonStyles.primary} py-2`}>
                {v.identityStatus === "retry_required" ? "Enviar novas fotos" : "Enviar fotos"}
              </Link>
            ) : v.identityStatus === "in_review" ? (
              <p className="text-sm text-muted">Recebemos suas fotos. Nossa equipe está analisando.</p>
            ) : undefined
          }
        />
        <Step
          n={3}
          title="Assinar o contrato"
          text={
            v.contractStatus === "signed"
              ? "Contrato assinado. Obrigado!"
              : v.contractStatus === "sent"
                ? "Enviamos o contrato para o seu e-mail pela D4Sign, nossa plataforma de assinatura digital. Procure o e-mail da D4Sign (confira também o spam/lixo eletrônico) e assine."
                : v.contractStatus === "queued"
                  ? "Estamos preparando o seu contrato. Em instantes ele chega no seu e-mail pela D4Sign."
                  : "Assim que o pagamento é confirmado, enviamos o contrato digital (D4Sign) para o seu e-mail."
          }
          state={v.contractStatus === "signed" ? "feito" : paid ? "pendente" : "bloqueado"}
        />
        <Step
          n={4}
          title="Dados do aparelho"
          text={v.deviceStatus === "confirmed" ? `${deviceLabel} recebidos (IMEI final ${v.imeiLast4}).` : `Informe o ${deviceLabel}. Leva 1 minuto.`}
          state={!paid ? "bloqueado" : v.deviceStatus === "confirmed" ? "feito" : "pendente"}
          action={
            paid && !ready ? (
              <Link href="/minha-area/aparelho" className={`${buttonStyles.primary} py-2`}>
                {v.deviceStatus === "confirmed" ? "Corrigir dados" : "Informar agora"}
              </Link>
            ) : undefined
          }
        />
      </ol>
    </div>
  );
}

async function Area({ searchParams }: { searchParams: PageProps<"/minha-area">["searchParams"] }) {
  const sp = await searchParams;
  const orderId = await currentOrderId();
  const view = orderId ? await getAreaView(orderId) : null;
  if (!view) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border p-6 text-center">
        <h1 className="text-2xl font-bold">Minha área</h1>
        <p className="mt-3 text-muted">
          {sp.link === "invalido"
            ? "Este link expirou ou não é válido."
            : "Para acessar, use o link que enviamos para o seu e-mail depois do pagamento."}
        </p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm text-muted">Pedido {view.code} · {view.planName} · {view.simType === "esim" ? "eSIM" : "Chip físico"}</p>
        <h1 className="text-3xl font-bold">Olá, {view.firstName}!</h1>
        <p className="mt-1 text-muted">Acompanhe aqui as etapas para ativar sua linha.</p>
      </div>
      <Checklist v={view} />
    </div>
  );
}

export default function MinhaAreaPage({ searchParams }: PageProps<"/minha-area">) {
  return (
    <Container className="py-12">
      <Suspense fallback={<div className="mx-auto h-96 max-w-2xl animate-pulse rounded-2xl bg-surface" />}>
        <Area searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { ArrowRight, Check, Clock, FileSignature, Lock, Mail, MessageCircle } from "lucide-react";
import { whatsappLink } from "@/components/whatsapp";
import { currentOrderId } from "@/lib/server/customer-access";
import { deviceForWhatsapp, getAreaView, type AreaView } from "@/lib/server/customer-area";
import { getIdentityReview } from "@/lib/server/identity";
import { identityMode } from "@/lib/server/identity-mode";
import { LinhaPedido } from "../linha-pedido";
import { IdentityForm } from "../minha-area/identidade/identity-form";
import { RefreshWhileWaiting } from "./refresh-while-waiting";
import { RegistroEsim, RegistroFisico } from "./registro";

export const metadata: Metadata = { title: "Formulário de ativação", robots: { index: false } };

/*
 * Formulário de ativação (D28, desenho do Lovable):
 *   1. Registro do chip — eSIM: print do registro do eSIM (*#06#); chip físico: foto do verso da embalagem
 *   2. Contrato no e-mail (Clicksign; antes D4Sign — documento + rosto)
 *   3. Ativação pelo WhatsApp (mensagem com os dados do pedido, sem CPF nem documentos)
 * A etapa mostrada vem do estado do pedido no servidor; a página se atualiza enquanto espera a assinatura.
 */

function Etapas({ nomes, atual }: { nomes: string[]; atual: number }) {
  return (
    <ol className="ck-steps" aria-label="Etapas da ativação">
      {nomes.map((nome, i) => {
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

function Passo({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="ac-how-item">
      <span className="ac-how-n">{n}</span>
      <span>{children}</span>
    </li>
  );
}

function Moldura({ v, children }: { v?: AreaView; children: React.ReactNode }) {
  const gb = v ? /(\d+)\s*GB/i.exec(v.planName)?.[1] : null;
  return (
    <div className="ck-page">
      <div className="container-site ck-grid is-single">
        <div className="ck-card">
          {v && (
            <LinhaPedido texto={`Pedido ${v.code} · ${gb ? `Plano ${gb} GB` : v.planName} · ${v.simType === "esim" ? "eSIM" : "Chip físico"}`} />
          )}
          {children}
          <p className="ck-trust">
            <Lock size={14} /> Dados protegidos · nunca pedimos documentos por WhatsApp
          </p>
        </div>
      </div>
    </div>
  );
}

function Contrato({ v }: { v: AreaView }) {
  const enviado = v.contractStatus === "sent";
  return (
    <div>
      <p className="ck-kicker">Registro recebido ✓</p>
      <h1 className="ck-title">Assine o contrato no seu e-mail</h1>
      <p className="ck-sub">
        {enviado ? (
          <>
            Enviamos o contrato para <b>{v.emailMasked}</b> pela {v.plataforma}, plataforma de assinatura digital. Leva uns 3 minutos.
          </>
        ) : (
          <>
            Estamos preparando o seu contrato. Ele chega em <b>{v.emailMasked}</b> pela {v.plataforma} em instantes.
          </>
        )}
      </p>
      <div className="ac-how">
        <div>
          <p className="ac-how-title">Como assinar</p>
          <ol>
            <Passo n={1}>
              Abra o e-mail da <b>{v.plataforma}</b> (se não achar, olhe o spam ou Promoções).
            </Passo>
            <Passo n={2}>
              Clique em <b>{v.plataforma === "Clicksign" ? "Visualizar para assinar" : "Assinar"}</b> e leia o contrato.
            </Passo>
            {v.plataforma === "Clicksign" && (
              <Passo n={3}>
                Digite o <b>código</b> que a Clicksign manda no seu e-mail.
              </Passo>
            )}
            <Passo n={v.plataforma === "Clicksign" ? 4 : 3}>
              Tire uma <b>foto do seu documento</b> (RG ou CNH) e uma <b>selfie</b> quando pedir.
            </Passo>
          </ol>
        </div>
        <div className="ac-code">
          <FileSignature size={34} className="text-[#0a82c7]" />
          <span className="ac-code-label">Assinatura com reconhecimento facial</span>
          <span className="ac-safe">
            <Lock size={13} /> Nunca pedimos documentos por WhatsApp
          </span>
        </div>
      </div>
      <p className="ac-wait">
        <Clock size={15} /> Esta página avança sozinha quando a assinatura for concluída.
      </p>
      <RefreshWhileWaiting />
    </div>
  );
}

function Whatsapp({ wa }: { wa: string | null }) {
  return (
    <div>
      <p className="ck-kicker">Contrato assinado ✓</p>
      <h1 className="ck-title">Tudo pronto! Agora é só chamar a gente</h1>
      <p className="ck-sub">
        Clique no botão abaixo para enviar o seu pedido pelo WhatsApp. Nossa equipe ativa a linha e você recebe o número por e-mail.
      </p>
      {wa ? (
        <a href={wa} target="_blank" rel="noopener noreferrer" className="ac-whats">
          <MessageCircle size={22} /> Pedir ativação no WhatsApp <ArrowRight size={18} />
        </a>
      ) : (
        <p className="ac-wait">Seu pedido já está na fila de ativação. Nossa equipe fala com você.</p>
      )}
      <p className="ac-wait">
        <Clock size={15} /> A mensagem já vai com o número do pedido e os dados do chip. Não precisa mandar documentos.
      </p>
    </div>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/ativacao">["searchParams"] }) {
  const sp = await searchParams;
  const orderId = await currentOrderId();
  const v = orderId ? await getAreaView(orderId) : null;
  if (!v || !orderId) {
    return (
      <Moldura>
        <h1 className="ck-title">Formulário de ativação</h1>
        <p className="ck-sub ac-sub-big">
          {sp.link === "invalido" ? "Este link expirou ou não é válido." : "Abra o link do formulário que enviamos para o seu e-mail."}
        </p>
        <p className="ac-wait">
          <Mail size={15} /> Procure o e-mail da Gigachip (confira também o spam).
        </p>
      </Moldura>
    );
  }

  const paid = v.paymentStatus === "confirmed" || v.paymentStatus === "received";
  const deviceDone = v.deviceStatus === "confirmed";
  const signed = v.contractStatus === "signed";
  const manualIdentity = identityMode() === "manual";
  const identityDone = ["in_review", "approved"].includes(v.identityStatus);
  const canSendIdentity = v.status === "em_andamento" && ["not_started", "pending_documents", "retry_required"].includes(v.identityStatus);
  const editable = v.status === "em_andamento" || v.status === "pendencia";

  // D28: 1) registro do chip → (documento, se manual) → 2) contrato → 3) WhatsApp
  const nomes = manualIdentity ? ["Registro do chip", "Documento", "Contrato", "Ativação"] : ["Registro do chip", "Contrato", "Ativação"];
  const etapa = !deviceDone ? 1 : manualIdentity && !identityDone ? 2 : !signed ? nomes.length - 1 : nomes.length;

  const readyForWhatsapp = deviceDone && signed && (manualIdentity ? identityDone : true);
  const device = readyForWhatsapp ? await deviceForWhatsapp(orderId) : null;
  const wa = whatsappLink(
    [
      "Olá! Quero ativar minha linha Gigachip.",
      `Pedido: ${v.code}`,
      `Nome: ${v.fullName}`,
      `Plano: ${v.planName} (${v.simType === "esim" ? "eSIM" : "chip físico"})`,
      device?.imei ? `IMEI: ${device.imei}` : null,
      device?.eid ? `EID: ${device.eid}` : null,
      device?.iccid ? `ICCID: ${device.iccid}` : null,
      "Contrato assinado ✅",
    ]
      .filter(Boolean)
      .join("\n"),
  );
  const ajuda = whatsappLink(`Olá! Preciso de ajuda para enviar o registro do eSIM. Pedido ${v.code}.`);
  const review = manualIdentity && v.identityStatus === "retry_required" ? await getIdentityReview(orderId) : null;

  return (
    <Moldura v={v}>
      <Etapas nomes={nomes} atual={paid ? etapa : 1} />

      {!paid ? (
        <div>
          <h1 className="ck-title">Quase lá, {v.firstName}!</h1>
          <p className="ck-sub ac-sub-big">Assim que o pagamento for confirmado, este formulário é liberado. Esta página se atualiza sozinha.</p>
          <RefreshWhileWaiting />
        </div>
      ) : etapa === 1 ? (
        editable ? (
          v.simType === "esim" ? (
            <RegistroEsim ajudaWhatsapp={ajuda} />
          ) : (
            <RegistroFisico />
          )
        ) : (
          <p className="ck-sub">Esta etapa não está disponível agora. Fale com a gente pelo WhatsApp.</p>
        )
      ) : manualIdentity && etapa === 2 ? (
        <div>
          <p className="ck-kicker">Registro recebido ✓</p>
          <h1 className="ck-title">Envie seu documento e uma selfie</h1>
          {review?.rejectionReason && (
            <p className="ck-alert">
              <strong>Precisamos de novas fotos:</strong> {review.rejectionReason}
            </p>
          )}
          {canSendIdentity ? <IdentityForm redirectTo="/ativacao" /> : <p className="ck-sub">Esta etapa não está disponível agora.</p>}
        </div>
      ) : !signed ? (
        <Contrato v={v} />
      ) : (
        <Whatsapp wa={wa} />
      )}
    </Moldura>
  );
}

export default function AtivacaoPage({ searchParams }: PageProps<"/ativacao">) {
  return (
    <Suspense fallback={<div className="ck-page" style={{ minHeight: 700 }} />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

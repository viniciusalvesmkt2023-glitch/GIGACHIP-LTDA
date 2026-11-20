import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatBRL } from "@/lib/domain/money";
import { getOrderDetail, STATUS_LABEL } from "@/lib/server/admin";
import { getContractInfo } from "@/lib/server/contracts";
import { getIdentityReview } from "@/lib/server/identity";
import { requireStaff } from "@/lib/server/staff-auth";
import { decideIdentityAction, retryContractAction, revealAction, syncContractAction } from "../../actions";
import { ActionButton, IdentityDecisionForm, RevealButton } from "../../forms";
import { Card, PanelShell } from "../../shell";

export const metadata: Metadata = { title: "Pedido" };

const SUB: Record<string, string> = {
  pending: "Pendente", confirmed: "Confirmado", received: "Recebido", overdue: "Vencido", refunded: "Estornado", chargeback: "Chargeback", cancelled: "Cancelado",
  not_started: "Não iniciado", pending_documents: "Aguardando fotos", in_review: "Em análise", approved: "Aprovado", rejected: "Recusado", retry_required: "Novas fotos pedidas",
  not_created: "Não criado", queued: "Na fila", sent: "Enviado", signed: "Assinado", refused: "Recusado", error: "Erro", submitted: "Enviado", invalid: "Inválido",
};
const KIND: Record<string, string> = { doc_front: "Documento (frente)", doc_back: "Documento (verso)", selfie: "Selfie" };
const fmt = (d: Date | null) => (d ? d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");

async function Content({ params }: { params: PageProps<"/painel/pedidos/[id]">["params"] }) {
  const staff = await requireStaff();
  const { id } = await params;
  const o = await getOrderDetail(staff, id);
  if (!o) notFound();
  const identity = await getIdentityReview(id);
  const contract = await getContractInfo(id);
  const canSee = ["owner", "admin", "ativador"].includes(staff.role);

  return (
    <PanelShell staff={staff}>
      <Link href="/painel/pedidos" className="text-sm text-brand">← Pedidos</Link>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <h1 className="font-mono text-2xl font-bold">{o.code}</h1>
        <span className="rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand">{STATUS_LABEL[o.status] ?? o.status}</span>
        {o.problem_reason && <span className="rounded-full bg-red-100 px-3 py-1 text-sm text-danger">{o.problem_reason}</span>}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card title="Cliente">
          <dl className="space-y-1 text-sm">
            <div><dt className="inline text-muted">Nome: </dt><dd className="inline">{o.full_name}</dd></div>
            <div><dt className="inline text-muted">CPF: </dt><dd className="inline font-mono">{o.cpfMasked}</dd>{canSee && <> · <RevealButton action={revealAction} orderId={o.id} field="cpf" label="ver completo" /></>}</div>
            <div><dt className="inline text-muted">Nascimento: </dt><dd className="inline">{o.birth_date.split("-").reverse().join("/")}</dd></div>
            <div><dt className="inline text-muted">E-mail: </dt><dd className="inline">{o.email}</dd></div>
            <div><dt className="inline text-muted">Celular: </dt><dd className="inline">{o.phone_e164}</dd></div>
          </dl>
        </Card>
        <Card title="Plano e pagamento">
          <dl className="space-y-1 text-sm">
            <div><dt className="inline text-muted">Plano: </dt><dd className="inline">{o.plan_name} · {o.sim_type === "esim" ? "eSIM" : "Chip físico lacrado"}</dd></div>
            <div><dt className="inline text-muted">Mensalidade: </dt><dd className="inline">{formatBRL(o.monthly_price_cents)}</dd></div>
            <div><dt className="inline text-muted">Pagamento: </dt><dd className="inline">{SUB[o.payment_status]} ({fmt(o.paid_at)})</dd></div>
            <div><dt className="inline text-muted">Criado: </dt><dd className="inline">{fmt(o.created_at)}</dd></div>
            <div><dt className="inline text-muted">Pronto em: </dt><dd className="inline">{fmt(o.ready_at)}</dd></div>
          </dl>
        </Card>
        <Card title="Aparelho / chip">
          {o.has_device ? (
            <dl className="space-y-1 text-sm">
              <div><dt className="inline text-muted">IMEI: </dt><dd className="inline font-mono">•••• {o.imei_last4}</dd>{canSee && <> · <RevealButton action={revealAction} orderId={o.id} field="imei" label="ver" /></>}</div>
              {o.sim_type === "esim" ? (
                <div><dt className="inline text-muted">EID: </dt>{canSee ? <RevealButton action={revealAction} orderId={o.id} field="eid" label="ver" /> : "•••"}</div>
              ) : (
                <div><dt className="inline text-muted">ICCID: </dt>{canSee ? <RevealButton action={revealAction} orderId={o.id} field="iccid" label="ver" /> : "•••"}</div>
              )}
              {o.has_print && canSee && (
                <div className="pt-2">
                  <a href={`/painel/prints/${o.id}`} target="_blank" rel="noopener noreferrer" className="font-medium text-brand underline">
                    Ver print do *#06#
                  </a>
                  {o.device_source === "ocr_confirmed" && <span className="ml-2 text-xs text-muted">(números lidos do print e confirmados pelo cliente)</span>}
                </div>
              )}
              {o.checksum_warnings && o.checksum_warnings.length > 0 && (
                <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs">⚠️ O cliente confirmou um número com dígito verificador suspeito. Confira antes de ativar.</p>
              )}
            </dl>
          ) : (
            <p className="text-sm text-muted">Ainda não informado.</p>
          )}
        </Card>
      </div>

      <Card title={`Identidade — ${SUB[o.identity_status] ?? o.identity_status}`} className="mt-4">
        {identity && identity.files.length > 0 ? (
          <div className="space-y-4">
            {canSee ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {identity.files.map((f) => (
                  <a key={f.id} href={`/painel/arquivos/${f.id}`} target="_blank" rel="noopener noreferrer" className="block">
                    <p className="mb-1 text-xs text-muted">{KIND[f.kind]}</p>
                    {/* eslint-disable-next-line @next/next/no-img-element -- imagem protegida, servida pelo painel */}
                    <img src={`/painel/arquivos/${f.id}`} alt={KIND[f.kind]} className="h-48 w-full rounded-lg border border-border object-contain bg-surface" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">Sua função não permite ver documentos.</p>
            )}
            <p className="text-xs text-muted">Tentativa {identity.attempts} de 3. Abrir as imagens fica registrado na auditoria.</p>
            {o.identity_status === "in_review" && canSee && <IdentityDecisionForm action={decideIdentityAction} orderId={o.id} />}
            {identity.rejectionReason && <p className="text-sm">Último motivo: {identity.rejectionReason}</p>}
          </div>
        ) : (
          <p className="text-sm text-muted">O cliente ainda não enviou as fotos.</p>
        )}
      </Card>

      <Card title={`Contrato — ${SUB[o.contract_status] ?? o.contract_status}`} className="mt-4">
        {contract ? (
          <div className="space-y-3 text-sm">
            <p>
              Enviado: {fmt(contract.sent_at)} · Assinado: {fmt(contract.signed_at)}
              {contract.status === "queued" && <> · Etapa: {contract.step} · tentativas: {contract.attempts}</>}
            </p>
            {contract.last_error && <p className="rounded-lg bg-red-50 p-2 text-xs text-danger">Último erro: {contract.last_error}</p>}
            <div className="flex flex-wrap items-start gap-3">
              {contract.has_file && canSee && (
                <a href={`/painel/contratos/${o.id}`} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-brand px-4 py-2 font-semibold text-white">
                  Baixar contrato assinado
                </a>
              )}
              {canSee && ["queued", "error", "refused", "cancelled"].includes(contract.status) && (
                <ActionButton action={retryContractAction} orderId={o.id} label={contract.status === "queued" ? "Enviar agora" : "Enviar de novo"} />
              )}
              {canSee && contract.status === "sent" && <ActionButton action={syncContractAction} orderId={o.id} label="Conferir assinatura na D4Sign" />}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">O contrato é gerado e enviado automaticamente quando a identidade é aprovada.</p>
        )}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Etapas">
          <ul className="space-y-1 text-sm">
            <li>Pagamento: {SUB[o.payment_status]}</li>
            <li>Identidade: {SUB[o.identity_status]}</li>
            <li>Contrato: {SUB[o.contract_status]}</li>
            <li>Aparelho: {SUB[o.device_status]}</li>
          </ul>
        </Card>
        <Card title="Histórico">
          <ul className="max-h-72 space-y-1 overflow-y-auto text-xs">
            {o.events.map((e, i) => (
              <li key={i}>
                <span className="text-muted">{fmt(e.created_at)}</span> · {e.field}: {e.from_value} → <strong>{e.to_value}</strong> ({e.actor_type}){e.reason ? ` — ${e.reason}` : ""}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </PanelShell>
  );
}

export default function PedidoPage({ params }: PageProps<"/painel/pedidos/[id]">) {
  return <Suspense fallback={<div className="p-8">Carregando…</div>}><Content params={params} /></Suspense>;
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatBRL, shortOrderNumber } from "@/lib/domain/money";
import { getOrderDetail, STATUS_LABEL } from "@/lib/server/admin";
import { getContractInfo } from "@/lib/server/contracts";
import { getIdentityReview } from "@/lib/server/identity";
import { activationDefaults, availableNumbers, lineForOrder } from "@/lib/server/lines";
import { formatMsisdn } from "@/lib/domain/lines";
import { AutoRefresh } from "@/components/auto-refresh";
import { identityMode } from "@/lib/server/identity-mode";
import { sheetEnabled } from "@/lib/server/planilha";
import { requireStaff } from "@/lib/server/staff-auth";
import { activateLineAction, changeEmailAction, decideIdentityAction, importSheetAction, retryContractAction, revealAction, syncContractAction } from "../../actions";
import { ActionButton, ActivateLineForm, ChangeEmailForm, IdentityDecisionForm, RevealButton } from "../../forms";
import { SheetStatus } from "../../sheet-status";
import { Card, PanelShell } from "../../shell";
import { StatusBadge } from "../../status-badge";

export const metadata: Metadata = { title: "Pedido" };

const SUB: Record<string, string> = {
  pending: "Pendente", confirmed: "Confirmado", received: "Recebido", overdue: "Vencido", refunded: "Estornado", chargeback: "Chargeback", cancelled: "Cancelado",
  not_started: "Não iniciado", pending_documents: "Aguardando fotos", in_review: "Em análise", approved: "Aprovado", rejected: "Recusado", retry_required: "Novas fotos pedidas",
  not_created: "Não criado", queued: "Na fila", sent: "Enviado", signed: "Assinado", refused: "Recusado", error: "Erro", submitted: "Enviado", invalid: "Inválido",
};
const CAMPO: Record<string, string> = { status: "Pedido", payment_status: "Pagamento", identity_status: "Identidade", contract_status: "Contrato", device_status: "Aparelho/chip" };
const KIND: Record<string, string> = { doc_front: "Documento (frente)", doc_back: "Documento (verso)", selfie: "Selfie" };
const fmtTime = (d: Date) => d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
const fmt = (d: Date | null) => (d ? d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");

async function Content({ params }: { params: PageProps<"/painel/pedidos/[id]">["params"] }) {
  const staff = await requireStaff();
  const { id } = await params;
  const o = await getOrderDetail(staff, id);
  if (!o) notFound();
  const identity = await getIdentityReview(id);
  const contract = await getContractInfo(id);
  const identityModeLabel = identityMode();
  const canActivate = ["owner", "admin", "ativador"].includes(staff.role) && ["pronto_para_ativacao", "em_ativacao"].includes(o.status);
  const [act, numbers] = canActivate ? await Promise.all([activationDefaults(id), availableNumbers()]) : [null, []];
  const brMoney = (c: number) => (c / 100).toFixed(2).replace(".", ",");
  const canSee = ["owner", "admin", "ativador"].includes(staff.role);
  const line = ["ativado", "pronto_para_ativacao", "em_ativacao"].includes(o.status) ? await lineForOrder(id) : null;
  const sheetOn = canActivate || line ? await sheetEnabled() : false;

  return (
    <PanelShell staff={staff}>
      <Link href="/painel/pedidos" className="od-back">← Pedidos</Link>
      <div className="od-head">
        <h1>Pedido {shortOrderNumber(o.code)}</h1>
        <StatusBadge status={o.status} />
        {/* Atualiza sozinha: esperando o cliente (15 s). Pronto para ativar: não, para não atrapalhar quem digita. */}
        {/* (a situação "escrevendo" da planilha já atualiza a página sozinha — ver SheetStatus) */}
        {["aguardando_pagamento", "em_andamento"].includes(o.status) ? <AutoRefresh seconds={15} /> : null}
        {o.problem_reason && <span className="pd-badge is-red">{o.problem_reason}</span>}
        <span className="od-sub">
          {o.full_name} · {o.plan_name} · {o.sim_type === "esim" ? "eSIM" : "Chip físico"}
        </span>
      </div>

      {/* andamento do pedido */}
      <ol className="od-track">
        {[
          { label: "Pagamento", v: o.payment_status, ok: ["confirmed", "received"] },
          { label: o.sim_type === "esim" ? "Registro do eSIM" : "Dados do chip", v: o.device_status, ok: ["confirmed"] },
          { label: "Contrato", v: o.contract_status, ok: ["signed"] },
          { label: "Identidade", v: o.identity_status, ok: ["approved"] },
          { label: "Linha ativada", v: o.status === "ativado" ? "ativado" : o.status, ok: ["ativado"] },
        ].map((st) => {
          const ok = st.ok.includes(st.v);
          const bad = ["rejected", "error", "refused", "invalid", "retry_required", "overdue", "chargeback"].includes(st.v);
          return (
            <li key={st.label} className={ok ? "is-ok" : bad ? "is-bad" : ""}>
              <span>{ok ? "✓" : bad ? "!" : ""}</span>
              <strong>{st.label}</strong>
              <small>{ok ? "Concluído" : SUB[st.v] ?? (st.label === "Linha ativada" ? "Aguardando" : st.v)}</small>
            </li>
          );
        })}
      </ol>

      {canActivate && act && (
        <Card title="⚡ Ativar linha" className="od-activate mt-6">
          <p className="mb-4 text-sm text-muted">
            Depois de ativar no portal da Vivo, escolha o número usado e digite o ICCID. O resto já vem preenchido — confira e confirme.
          </p>
          <ActivateLineForm
            action={activateLineAction}
            orderId={o.id}
            numbers={numbers.map((n) => ({ id: n.id, label: formatMsisdn(n.msisdn) }))}
            defaults={{
              customer: act.customer,
              iccid: act.iccidSuggestion,
              smartDados: act.smartDados,
              salePrice: brMoney(act.salePriceCents),
              cost: brMoney(act.costCents),
              nextDue: act.nextDueDate ? act.nextDueDate.split("-").reverse().join("/") : "—",
            }}
          />
          {sheetOn && (
            <div className="mt-4 border-t border-border pt-4 text-sm">
              <p className="mb-2 text-muted">
                Os números disponíveis vêm da planilha do gestor (lida de hora em hora). Ao confirmar, o sistema preenche a linha do
                número na planilha. Não achou o número? Leia a planilha agora:
              </p>
              <ActionButton action={importSheetAction} label="Ler planilha agora" />
            </div>
          )}
        </Card>
      )}

      {line && (
        <Card title="✅ Linha ativada" className="od-done mt-6">
          <p className="text-sm">
            Número <strong className="font-mono">{formatMsisdn(line.msisdn)}</strong> · ICCID <span className="font-mono">{line.iccid ?? "—"}</span> ·
            ativada em {fmt(line.activated_at)}
          </p>
          {sheetOn && (
            <div className="mt-2 text-sm">
              <SheetStatus
                now={new Date()}
                canRetry={canSee}
                line={{ id: line.id, pending: line.sheet_pending, error: line.sheet_error, syncedAt: line.sheet_synced_at, updatedAt: line.updated_at }}
              />
            </div>
          )}
        </Card>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card title="Cliente">
          <dl className="space-y-1 text-sm">
            <div><dt className="inline text-muted">Nome: </dt><dd className="inline">{o.full_name}</dd></div>
            <div><dt className="inline text-muted">CPF: </dt><dd className="inline font-mono">{o.cpfMasked}</dd>{canSee && <> · <RevealButton action={revealAction} orderId={o.id} field="cpf" label="ver completo" /></>}</div>
            <div><dt className="inline text-muted">Nascimento: </dt><dd className="inline">{o.birth_date.split("-").reverse().join("/")}</dd></div>
            <div><dt className="inline text-muted">E-mail: </dt><dd className="inline">{o.email}</dd></div>
            <div><dt className="inline text-muted">Celular: </dt><dd className="inline">{o.phone_e164}</dd></div>
          </dl>
          {canSee && o.status !== "ativado" && <ChangeEmailForm action={changeEmailAction} orderId={o.id} current={o.email} />}
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
              {o.imei_last4 && <div><dt className="inline text-muted">IMEI: </dt><dd className="inline font-mono">•••• {o.imei_last4}</dd>{canSee && <> · <RevealButton action={revealAction} orderId={o.id} field="imei" label="ver" /></>}</div>}
              {o.sim_type === "esim" ? (
                <div><dt className="inline text-muted">EID: </dt>{canSee ? <RevealButton action={revealAction} orderId={o.id} field="eid" label="ver" /> : "•••"}</div>
              ) : (
                <div><dt className="inline text-muted">ICCID: </dt>{canSee ? <RevealButton action={revealAction} orderId={o.id} field="iccid" label="ver" /> : "•••"}</div>
              )}
              {o.has_print && canSee && (
                <div className="pt-2">
                  <a href={`/painel/prints/${o.id}`} target="_blank" rel="noopener noreferrer" className="font-medium text-brand underline">
                    {o.sim_type === "esim" ? "Ver print do registro do eSIM" : "Ver imagem enviada (chip)"}
                  </a>
                  {o.device_source === "ocr_confirmed" && <span className="ml-2 text-xs text-muted">(números lidos da imagem e confirmados pelo cliente)</span>}
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
        {identity?.provider === "d4sign" ? (
          <p className="text-sm">
            ✅ Validada automaticamente na assinatura do contrato: a D4Sign exigiu <strong>foto do documento + selfie com
            reconhecimento facial</strong>. As imagens e o resultado ficam no relatório do documento, na D4Sign.
          </p>
        ) : identity?.provider === "d4sign_sem_selfie" ? (
          <div className="space-y-3 text-sm">
            <p>
              ⚠️ O contrato foi assinado <strong>sem</strong> a exigência de documento + selfie (enviado antes dessa opção ser
              ligada). Confira os dados do cliente e, se estiver tudo certo, aprove.
            </p>
            {o.identity_status === "in_review" && canSee && <IdentityDecisionForm action={decideIdentityAction} orderId={o.id} />}
          </div>
        ) : identity && identity.files.length > 0 ? (
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
          <p className="text-sm text-muted">
            {identityModeLabel === "d4sign"
              ? "Será validada automaticamente quando o cliente assinar o contrato (documento + selfie na D4Sign)."
              : "O cliente ainda não enviou as fotos."}
          </p>
        )}
      </Card>

      <Card title={`Contrato — ${SUB[o.contract_status] ?? o.contract_status}`} className="mt-4">
        {contract ? (
          <div className="space-y-3 text-sm">
            <p>
              Enviado: {fmt(contract.sent_at)} · Assinado: {fmt(contract.signed_at)}
              {contract.status === "queued" && <> · Etapa: {contract.step} · tentativas: {contract.attempts}</>}
            </p>
            {contract.d4sign && (
              <p className="rounded-lg bg-surface p-2 text-xs text-muted">
                Chamadas livres na D4Sign agora: {contract.d4sign.free} de {contract.d4sign.limit} por hora · este envio precisa de {contract.d4sign.needed}.
                {contract.d4sign.freesAt
                  ? <> Aguardando o limite: libera por volta de {fmtTime(contract.d4sign.freesAt)} e a rotina (a cada 10 min) envia sozinha.</>
                  : <> Próxima tentativa automática: {contract.next_attempt_at && contract.next_attempt_at > new Date() ? fmtTime(contract.next_attempt_at) : "na próxima rodada da rotina"}.</>}
              </p>
            )}
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

      <Card title="Histórico" className="mt-4">
        <ul className="od-timeline">
          {o.events.map((e, i) => (
            <li key={i}>
              <span className="od-when">{fmt(e.created_at)}</span>
              <span>
                {CAMPO[e.field] ?? e.field}: {SUB[e.from_value ?? ""] ?? STATUS_LABEL[e.from_value ?? ""] ?? e.from_value} →{" "}
                <strong>{SUB[e.to_value ?? ""] ?? STATUS_LABEL[e.to_value ?? ""] ?? e.to_value}</strong>
                <em>{e.actor_type === "staff" ? "equipe" : e.actor_type === "system" ? "sistema" : e.actor_type === "customer" ? "cliente" : e.actor_type}</em>
                {e.reason ? <small> — {e.reason}</small> : null}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </PanelShell>
  );
}

export default function PedidoPage({ params }: PageProps<"/painel/pedidos/[id]">) {
  return <Suspense fallback={<div className="p-8">Carregando…</div>}><Content params={params} /></Suspense>;
}

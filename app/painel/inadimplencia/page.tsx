import type { Metadata } from "next";
import { Suspense } from "react";
import { BLOCKED_DAYS_BEFORE_CANCEL } from "@/lib/contract/settings";
import { formatMsisdn } from "@/lib/domain/lines";
import { formatBRL } from "@/lib/domain/money";
import { lastOverdueSync, overdueBoard, type BoardRow } from "@/lib/server/inadimplencia";
import { requireStaff } from "@/lib/server/staff-auth";
import { blockCustomerAction, syncOverdueAction, unblockCustomerAction } from "../actions";
import { ActionButton, BlockForm, HiddenFieldsButton } from "../forms";
import { Card, PanelShell } from "../shell";

export const metadata: Metadata = { title: "Inadimplência" };

const brDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
const brDateTime = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const dias = (n: number) => (n === 1 ? "1 dia" : `${n} dias`);

function Numbers({ row }: { row: BoardRow }) {
  if (!row.lines.length) {
    return (
      <p className="text-xs text-muted">
        {row.suggestedLineId ? "Número: achamos pelo nome na planilha — confira ao lado" : "Número: procure na planilha pelo nome"}
      </p>
    );
  }
  return (
    <p className="text-sm">
      {row.lines.map((l) => (
        <span key={l.id} className="mr-3 inline-block font-mono">
          {formatMsisdn(l.msisdn)}
          {l.vivoLogin && <span className="ml-1 font-sans text-xs text-muted">({l.vivoLogin})</span>}
          {l.sheetRow && <span className="ml-1 font-sans text-xs text-muted">· linha {l.sheetRow} da planilha</span>}
        </span>
      ))}
    </p>
  );
}

function Debts({ row }: { row: BoardRow }) {
  return (
    <ul className="mt-1 space-y-0.5 text-xs text-muted">
      {row.items.map((i) => (
        <li key={i.id}>
          {formatBRL(i.valueCents)} · venceu {brDate(i.due)} ({dias(i.daysLate)} de atraso)
          {i.invoiceUrl && <> · <a href={i.invoiceUrl} target="_blank" rel="noopener noreferrer" className="text-brand underline">cobrança no Asaas</a></>}
        </li>
      ))}
    </ul>
  );
}

async function Content() {
  const staff = await requireStaff(["owner", "admin", "ativador", "financeiro"]);
  const [board, last] = await Promise.all([overdueBoard(), lastOverdueSync()]);
  const canAct = ["owner", "admin", "ativador"].includes(staff.role);
  const linkable = board.linkable.map((l) => ({ id: l.id, label: `${l.sheet_row ? `#${l.sheet_row} · ` : ""}${formatMsisdn(l.msisdn)}${l.name ? ` — ${l.name}` : ""}` }));

  return (
    <PanelShell staff={staff}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Inadimplência</h1>
          <p className="mt-1 text-sm text-muted">
            Puxado do Asaas (todos os clientes, inclusive os da planilha). O Asaas marca como vencida no dia seguinte ao
            vencimento. Última atualização: {last ? brDateTime(last) : "ainda não atualizado"}.
          </p>
        </div>
        <ActionButton action={syncOverdueAction} label="Atualizar agora" />
      </div>

      <Card title={`🔴 Bloquear linha — sem pagamento (${board.bloquear.length})`} className="mt-6">
        {board.bloquear.length === 0 ? (
          <p className="text-sm text-muted">Ninguém para bloquear. 🎉</p>
        ) : (
          <ul className="divide-y divide-border">
            {board.bloquear.map((r) => (
              <li key={r.customerId} className="grid gap-3 py-4 sm:grid-cols-[1fr_260px]">
                <div>
                  <p className="font-semibold">{r.name}</p>
                  <Numbers row={r} />
                  <Debts row={r} />
                  <p className="mt-1 text-xs font-medium text-danger">Bloquear linha — sem pagamento</p>
                </div>
                {canAct && (
                  <BlockForm
                    action={blockCustomerAction}
                    customerId={r.customerId}
                    name={r.name}
                    lines={r.lines.length ? null : linkable}
                    suggestedLineId={r.suggestedLineId}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`🟢 Desbloquear — pagou (${board.desbloquear.length})`} className="mt-4">
        {board.desbloquear.length === 0 ? (
          <p className="text-sm text-muted">Ninguém para desbloquear agora.</p>
        ) : (
          <ul className="divide-y divide-border">
            {board.desbloquear.map((r) => (
              <li key={r.customerId} className="grid gap-3 py-4 sm:grid-cols-[1fr_260px]">
                <div>
                  <p className="font-semibold">{r.name}</p>
                  <Numbers row={r} />
                  <p className="mt-1 text-xs text-muted">
                    Pagou{r.paidAt ? ` em ${brDateTime(r.paidAt)}` : ""} · bloqueada desde {r.blockedAt ? brDateTime(r.blockedAt) : "—"}.
                    Pelo contrato, desbloquear em até 24 h.
                  </p>
                </div>
                {canAct && r.blockId && (
                  <HiddenFieldsButton
                    action={unblockCustomerAction}
                    fields={{ blockId: r.blockId }}
                    label="Desbloqueei na Vivo"
                    variant="primary"
                    confirm={`Confirma que você DESBLOQUEOU a linha de ${r.name} na Vivo?`}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`🔒 Bloqueadas — aguardando pagamento (${board.bloqueado.length})`} className="mt-4">
        {board.bloqueado.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma linha bloqueada.</p>
        ) : (
          <ul className="divide-y divide-border">
            {board.bloqueado.map((r) => (
              <li key={r.customerId} className="py-4">
                <p className="font-semibold">{r.name}</p>
                <Numbers row={r} />
                <Debts row={r} />
                <p className={`mt-1 text-xs ${(r.blockedDays ?? 0) >= BLOCKED_DAYS_BEFORE_CANCEL ? "font-semibold text-danger" : "text-muted"}`}>
                  Bloqueada há {dias(r.blockedDays ?? 0)}
                  {(r.blockedDays ?? 0) >= BLOCKED_DAYS_BEFORE_CANCEL && ` — passou de ${BLOCKED_DAYS_BEFORE_CANCEL} dias: pelo contrato, já pode cancelar`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PanelShell>
  );
}

export default function InadimplenciaPage() {
  return <Suspense fallback={<div className="p-8">Carregando…</div>}><Content /></Suspense>;
}

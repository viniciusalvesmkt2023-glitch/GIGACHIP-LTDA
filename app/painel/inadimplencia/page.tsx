import type { Metadata } from "next";
import { Suspense } from "react";
import { Ban, CircleCheck, ExternalLink, Info, Lock, type LucideIcon } from "lucide-react";
import { BLOCKED_DAYS_BEFORE_CANCEL } from "@/lib/contract/settings";
import { formatMsisdn } from "@/lib/domain/lines";
import { formatBRL } from "@/lib/domain/money";
import { lastOverdueSync, overdueBoard, type BoardRow } from "@/lib/server/inadimplencia";
import { requireStaff } from "@/lib/server/staff-auth";
import { blockCustomerAction, syncOverdueAction, unblockCustomerAction } from "../actions";
import { ActionButton, BlockForm, HiddenFieldsButton } from "../forms";
import { PanelShell } from "../shell";

export const metadata: Metadata = { title: "Inadimplência" };

const brDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
const brDateTime = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const dias = (n: number) => (n === 1 ? "1 dia" : `${n} dias`);
const iniciais = (nome: string) =>
  nome
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 2 || /^[A-ZÀ-Ú]/.test(p))
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "?";

function Numbers({ row }: { row: BoardRow }) {
  if (!row.lines.length) {
    return (
      <p className="in-nonum">
        {row.suggestedLineId ? "Número: achamos pelo nome na planilha — confira ao lado" : "Número: procure na planilha pelo nome"}
      </p>
    );
  }
  return (
    <p className="in-nums">
      {row.lines.map((l) => (
        <span key={l.id}>
          <b>{formatMsisdn(l.msisdn)}</b>
          {l.vivoLogin && <small>login {l.vivoLogin}</small>}
          {l.sheetRow && <small>planilha L{l.sheetRow}</small>}
        </span>
      ))}
    </p>
  );
}

function Debts({ row }: { row: BoardRow }) {
  return (
    <ul className="in-debts">
      {row.items.map((i) => (
        <li key={i.id}>
          <b>{formatBRL(i.valueCents)}</b> · venceu {brDate(i.due)} · {dias(i.daysLate)} de atraso
          {i.invoiceUrl && (
            <a href={i.invoiceUrl} target="_blank" rel="noopener noreferrer">
              cobrança no Asaas <ExternalLink size={11} />
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function Secao({ tone, icon: Icon, title, hint, count, children }: {
  tone: "red" | "green" | "amber"; icon: LucideIcon; title: string; hint: string; count: number; children: React.ReactNode;
}) {
  return (
    <section className={`in-sec is-${tone}`}>
      <header>
        <span className="in-sec-icon"><Icon size={18} /></span>
        <div>
          <h2>{title} <em>{count}</em></h2>
          <p>{hint}</p>
        </div>
      </header>
      <div className="in-list">{children}</div>
    </section>
  );
}

async function Content() {
  const staff = await requireStaff(["owner", "admin", "ativador", "financeiro"]);
  const [board, last] = await Promise.all([overdueBoard(), lastOverdueSync()]);
  const canAct = ["owner", "admin", "ativador"].includes(staff.role);
  const linkable = board.linkable.map((l) => ({ id: l.id, label: `${l.sheet_row ? `#${l.sheet_row} · ` : ""}${formatMsisdn(l.msisdn)}${l.name ? ` — ${l.name}` : ""}` }));
  const emAtraso = [...board.bloquear, ...board.bloqueado].reduce((a, r) => a + r.totalCents, 0);
  const paraCancelar = board.bloqueado.filter((r) => (r.blockedDays ?? 0) >= BLOCKED_DAYS_BEFORE_CANCEL).length;

  return (
    <PanelShell staff={staff}>
      <div className="ln-top">
        <div className="pn-head">
          <h1>Inadimplência</h1>
          <p>Puxado do Asaas · atualizado {last ? `em ${brDateTime(last)}` : "ainda não"}</p>
        </div>
        <div className="in-sync">
          <ActionButton action={syncOverdueAction} label="Atualizar agora" />
        </div>
      </div>

      <div className="in-kpis">
        <a href="#bloquear" className={`in-kpi is-red ${board.bloquear.length ? "is-on" : ""}`}>
          <span><Ban size={16} /> Bloquear na Vivo</span>
          <strong>{board.bloquear.length}</strong>
          <small>sem pagamento</small>
        </a>
        <a href="#desbloquear" className={`in-kpi is-green ${board.desbloquear.length ? "is-on" : ""}`}>
          <span><CircleCheck size={16} /> Desbloquear na Vivo</span>
          <strong>{board.desbloquear.length}</strong>
          <small>pagaram — até 24 h</small>
        </a>
        <a href="#bloqueadas" className="in-kpi is-amber">
          <span><Lock size={16} /> Bloqueadas</span>
          <strong>{board.bloqueado.length}</strong>
          <small>{paraCancelar ? (paraCancelar === 1 ? "1 já pode ser cancelada" : `${paraCancelar} já podem ser canceladas`) : "aguardando pagamento"}</small>
        </a>
        <div className="in-kpi">
          <span>Em atraso</span>
          <strong>{formatBRL(emAtraso)}</strong>
          <small>de quem ainda não pagou</small>
        </div>
      </div>

      <div id="bloquear">
        <Secao tone="red" icon={Ban} title="Bloquear — sem pagamento" hint="Bloqueie na Vivo e depois clique em “Bloqueei na Vivo”." count={board.bloquear.length}>
          {board.bloquear.length === 0 && <p className="pd-empty">Ninguém para bloquear. 🎉</p>}
          {board.bloquear.map((r) => (
            <div key={r.customerId} className="in-row">
              <span className="in-avatar">{iniciais(r.name)}</span>
              <div className="in-main">
                <strong>{r.name}</strong>
                <Numbers row={r} />
                <Debts row={r} />
              </div>
              <div className="in-total">
                <strong>{formatBRL(r.totalCents)}</strong>
                <span className="pd-badge is-red">{dias(r.maxDaysLate)} de atraso</span>
              </div>
              {canAct && (
                <div className="in-act">
                  <BlockForm action={blockCustomerAction} customerId={r.customerId} name={r.name} lines={r.lines.length ? null : linkable} suggestedLineId={r.suggestedLineId} />
                </div>
              )}
            </div>
          ))}
        </Secao>
      </div>

      <div id="desbloquear">
        <Secao tone="green" icon={CircleCheck} title="Desbloquear — pagou" hint="Pelo contrato, desbloquear em até 24 h depois do pagamento." count={board.desbloquear.length}>
          {board.desbloquear.length === 0 && <p className="pd-empty">Ninguém para desbloquear agora.</p>}
          {board.desbloquear.map((r) => (
            <div key={r.customerId} className="in-row">
              <span className="in-avatar">{iniciais(r.name)}</span>
              <div className="in-main">
                <strong>{r.name}</strong>
                <Numbers row={r} />
                <p className="in-note">
                  Pagou{r.paidAt ? ` em ${brDateTime(r.paidAt)}` : ""} · bloqueada desde {r.blockedAt ? brDateTime(r.blockedAt) : "—"}
                </p>
              </div>
              <div className="in-total">
                <span className="pd-badge is-green">Pago</span>
              </div>
              {canAct && r.blockId && (
                <div className="in-act">
                  <HiddenFieldsButton
                    action={unblockCustomerAction}
                    fields={{ blockId: r.blockId }}
                    label="Desbloqueei na Vivo"
                    variant="primary"
                    confirm={`Confirma que você DESBLOQUEOU a linha de ${r.name} na Vivo?`}
                  />
                </div>
              )}
            </div>
          ))}
        </Secao>
      </div>

      <div id="bloqueadas">
        <Secao tone="amber" icon={Lock} title="Bloqueadas — aguardando pagamento" hint={`A partir de ${BLOCKED_DAYS_BEFORE_CANCEL} dias bloqueada, o contrato já permite cancelar.`} count={board.bloqueado.length}>
          {board.bloqueado.length === 0 && <p className="pd-empty">Nenhuma linha bloqueada.</p>}
          {board.bloqueado.map((r) => {
            const d = r.blockedDays ?? 0;
            const cancelar = d >= BLOCKED_DAYS_BEFORE_CANCEL;
            return (
              <div key={r.customerId} className="in-row">
                <span className="in-avatar">{iniciais(r.name)}</span>
                <div className="in-main">
                  <strong>{r.name}</strong>
                  <Numbers row={r} />
                  <Debts row={r} />
                </div>
                <div className="in-total">
                  <strong>{formatBRL(r.totalCents)}</strong>
                  <span className={`pd-badge ${cancelar ? "is-red" : "is-amber"}`}>Bloqueada há {dias(d)}</span>
                  {cancelar && <small className="in-cancel">Já pode cancelar (contrato)</small>}
                </div>
              </div>
            );
          })}
        </Secao>
      </div>

      <p className="in-foot">
        <Info size={14} /> O Asaas marca a cobrança como vencida no dia seguinte ao vencimento. A lista inclui os clientes do site e os da planilha.
      </p>
    </PanelShell>
  );
}

export default function InadimplenciaPage() {
  return (
    <Suspense fallback={<div className="p-8">Carregando…</div>}>
      <Content />
    </Suspense>
  );
}

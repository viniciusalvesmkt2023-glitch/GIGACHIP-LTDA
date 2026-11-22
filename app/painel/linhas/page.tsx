import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Download, ExternalLink, FileSpreadsheet, Pencil, Plus, Search, TriangleAlert } from "lucide-react";
import { formatMsisdn } from "@/lib/domain/lines";
import { AutoRefresh } from "@/components/auto-refresh";
import { formatBRL } from "@/lib/domain/money";
import { sheetWriteState } from "@/lib/domain/planilha";
import { lineCounts, listLines } from "@/lib/server/lines";
import { getSheetConfig, lastSheetRead, sheetEnabled, sheetQueueCounts } from "@/lib/server/planilha";
import { requireStaff } from "@/lib/server/staff-auth";
import { addNumbersAction, importSheetAction, retrySheetAction } from "../actions";
import { ActionButton, AddNumbersForm, HiddenFieldsButton } from "../forms";
import { sheetBadge } from "../sheet-status";
import { PanelShell, PanelLoading } from "../shell";
import { LineBadge, LINE_STATUS } from "../status-badge";

export const metadata: Metadata = { title: "Linhas" };

const STATUS = LINE_STATUS;
/** Filtros rápidos, na ordem do dia a dia. */
const CHIPS = ["ativa", "disponivel", "suspensao_pendente", "reativacao_pendente", "cancelamento_pendente", "suspensa", "cancelada"];
const TAREFA = new Set(["suspensao_pendente", "reativacao_pendente", "cancelamento_pendente"]);

const brDate = (d: Date | string | null) => {
  if (!d) return "—";
  // Data de calendário em São Paulo (ativação às 22h do dia 20 continua sendo dia 20)
  const iso = typeof d === "string" ? d : new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
  const [y, m, day] = iso.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
};

async function Content({ searchParams }: { searchParams: PageProps<"/painel/linhas">["searchParams"] }) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const status = typeof sp.status === "string" && STATUS[sp.status] ? sp.status : undefined;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const [rows, counts, sheetOn] = await Promise.all([listLines({ status, q }), lineCounts(), sheetEnabled()]);
  const [lastRead, queue, sheetCfg] = sheetOn ? await Promise.all([lastSheetRead(), sheetQueueCounts(), getSheetConfig()]) : [null, null, null];
  const sheetUrl = sheetCfg ? `https://docs.google.com/spreadsheets/d/${sheetCfg.spreadsheetId}/edit` : null;
  const rowUrl = (gid: number | null, row: number) => `${sheetUrl}#gid=${gid ?? 0}&range=A${row}`;
  const now = new Date();
  const stateOf = (r: (typeof rows)[number]) =>
    sheetWriteState({ pending: r.sheetPending, error: r.sheetError, syncedAt: r.sheetSyncedAt, updatedAt: r.updatedAt }, now);
  // Com erro ou presas na fila (pendentes há mais de 2 min sem erro registrado)
  const sheetErrors = rows.filter((r) => ["erro", "na_fila"].includes(stateOf(r)));
  const writing = rows.some((r) => stateOf(r) === "escrevendo");
  const canAct = ["owner", "admin", "ativador"].includes(staff.role);
  const canEdit = ["owner", "admin"].includes(staff.role);
  const canExport = ["owner", "admin", "financeiro"].includes(staff.role);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const href = (s?: string) => {
    const u = new URLSearchParams();
    if (s) u.set("status", s);
    if (q) u.set("q", q);
    const t = u.toString();
    return `/painel/linhas${t ? `?${t}` : ""}`;
  };
  const lida = lastRead
    ? lastRead.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : null;

  const erroItem = (r: (typeof rows)[number]) => (
    <li key={r.id}>
      <p>
        <b>{formatMsisdn(r.msisdn)}</b> · {r.customer ?? "—"}
        <span className={r.sheetError ? "text-danger" : "text-amber-700"}>
          {r.sheetError ?? "Na fila — a rotina tenta de novo em até 10 minutos."}
        </span>
      </p>
      {canAct && <HiddenFieldsButton action={retrySheetAction} fields={{ lineId: r.id }} label="Tentar de novo" />}
    </li>
  );

  return (
    <PanelShell staff={staff}>
      <div className="ln-top">
        <div className="pn-head">
          <h1>Linhas</h1>
          <p>
            {counts.ativa ?? 0} ativas · {counts.disponivel ?? 0} números disponíveis · {counts.suspensa ?? 0} bloqueadas
          </p>
        </div>
        {canExport && (
          // eslint-disable-next-line @next/next/no-html-link-for-pages -- download de arquivo (route handler), não é página
          <a href="/painel/linhas/exportar" className="ln-btn">
            <Download size={16} /> Baixar Excel
          </a>
        )}
      </div>

      {/* Atualiza sozinha só enquanto algo acabou de ir para a planilha (não para sempre) */}
      {writing && <AutoRefresh seconds={3} />}
      {sheetOn && (
        <div className="ln-sheet">
          <span className="ln-sheet-icon">
            <FileSpreadsheet size={20} />
          </span>
          <p>
            <strong>Planilha do gestor conectada</strong>
            <small>
              {lida ? `Lida em ${lida}` : "Ainda não foi lida"}
              {queue && queue.pending > 0 && <> · {queue.pending} para escrever</>}
              {queue && queue.errors > 0 && <b> · {queue.errors} com aviso</b>}
            </small>
          </p>
          <div className="ln-sheet-actions">
            {sheetUrl && (
              <a href={sheetUrl} target="_blank" rel="noopener noreferrer" className="ln-btn">
                Abrir planilha <ExternalLink size={14} />
              </a>
            )}
            {canAct && <ActionButton action={importSheetAction} label="Ler planilha agora" />}
          </div>
        </div>
      )}

      {sheetErrors.length > 0 && (
        <div className="ln-alert" role="alert">
          <p className="ln-alert-title">
            <TriangleAlert size={18} /> {sheetErrors.length === 1 ? "1 linha não foi escrita na planilha" : `${sheetErrors.length} linhas não foram escritas na planilha`}
          </p>
          <ul>{sheetErrors.slice(0, 3).map(erroItem)}</ul>
          {sheetErrors.length > 3 && (
            <details>
              <summary>Ver mais {sheetErrors.length - 3}</summary>
              <ul>{sheetErrors.slice(3).map(erroItem)}</ul>
            </details>
          )}
        </div>
      )}

      <form className="pd-search">
        <Search size={18} aria-hidden="true" />
        <input name="q" defaultValue={q} placeholder="Buscar por número, cliente, ICCID ou pedido" aria-label="Buscar linhas" />
        {status && <input type="hidden" name="status" value={status} />}
        <button>Buscar</button>
      </form>

      <div className="pd-chips" role="group" aria-label="Filtrar por situação">
        <Link href={href()} className={`sc-chip ${!status ? "is-on" : ""}`}>
          Todas <em>{total}</em>
        </Link>
        {CHIPS.filter((s) => !TAREFA.has(s) || counts[s] || status === s).map((s) => (
          <Link key={s} href={href(s)} className={`sc-chip ${status === s ? "is-on" : ""} ${TAREFA.has(s) && counts[s] ? "is-hot" : ""}`}>
            {STATUS[s]!.label} <em>{counts[s] ?? 0}</em>
          </Link>
        ))}
      </div>

      <div className="pd-list ln-list">
        <div className="ln-row pd-row-head" aria-hidden="true">
          <span>Número</span>
          <span>Cliente</span>
          <span>Plano</span>
          <span>Ativação</span>
          <span>Venda</span>
          <span>Vencimento</span>
          <span>Situação</span>
          <span />
        </div>
        {rows.map((r) => {
          const badge = sheetOn ? sheetBadge(stateOf(r)) : null;
          const livre = r.status === "disponivel";
          return (
            <div key={r.id} className={`ln-row ${TAREFA.has(r.status) ? "is-hot" : ""} ${livre ? "is-free" : ""}`}>
              <span className="ln-num">
                <strong>{formatMsisdn(r.msisdn)}</strong>
                <small>
                  {r.iccid ? `ICCID ${r.iccid}` : "Sem ICCID"}
                  {r.sheetRow && sheetUrl && (
                    <>
                      {" · "}
                      <a href={rowUrl(r.sheetGid, r.sheetRow)} target="_blank" rel="noopener noreferrer" title={r.sheetTab ? `Aba “${r.sheetTab}”, linha ${r.sheetRow}` : undefined}>
                        planilha L{r.sheetRow}
                      </a>
                    </>
                  )}
                </small>
              </span>
              <span className="ln-cell">
                {livre ? (
                  <strong className="ln-free">Livre para vender</strong>
                ) : r.orderId ? (
                  <Link href={`/painel/pedidos/${r.orderId}`} className="ln-client">
                    {r.customer}
                  </Link>
                ) : (
                  <strong>{r.customer ?? "—"}</strong>
                )}
                <small>
                  {[r.orderCode && `Pedido ${r.orderCode}`, r.vivoLogin && `Login ${r.vivoLogin}`].filter(Boolean).join(" · ") || "—"}
                </small>
              </span>
              <span className="ln-cell">
                <strong className="ln-wrap">{r.smartDados || r.planoPj || "—"}</strong>
                {r.smartDados && r.planoPj && <small title={r.planoPj}>{r.planoPj}</small>}
              </span>
              <span className="ln-cell" data-label="Ativação">
                <strong>{livre ? "—" : brDate(r.activatedAt)}</strong>
              </span>
              <span className="ln-cell" data-label="Venda">
                <strong>{r.salePriceCents !== null ? formatBRL(r.salePriceCents) : "—"}</strong>
                {r.costCents !== null && <small>gestor {formatBRL(r.costCents)}</small>}
              </span>
              <span className="ln-cell" data-label="Vencimento">
                <strong>{livre ? "—" : brDate(r.dueDate)}</strong>
                {r.paymentMethod && <small>{r.paymentMethod}</small>}
              </span>
              <span className="ln-status">
                <LineBadge status={r.status} />
                {badge && <small className={badge.className}>{badge.label}</small>}
              </span>
              <span className="ln-act">
                {canAct && !livre && (
                  <Link href={`/painel/linhas/${r.id}`} className="ln-edit" aria-label={`Editar a linha ${formatMsisdn(r.msisdn)}`} title="Editar">
                    <Pencil size={15} />
                  </Link>
                )}
              </span>
            </div>
          );
        })}
        {rows.length === 0 && <p className="pd-empty">Nenhuma linha encontrada.</p>}
      </div>

      {canEdit && (
        <details className="pn-card ln-add">
          <summary>
            <Plus size={18} /> {sheetOn ? "Adicionar números à mão (normalmente vêm da planilha)" : "Adicionar números disponíveis ao estoque"}
          </summary>
          <div className="mt-4">
            <AddNumbersForm action={addNumbersAction} />
          </div>
        </details>
      )}
    </PanelShell>
  );
}

export default function LinhasPage({ searchParams }: PageProps<"/painel/linhas">) {
  return (
    <Suspense fallback={<PanelLoading />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

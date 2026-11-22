import { AutoRefresh } from "@/components/auto-refresh";
import { sheetWriteState, type SheetWriteState } from "@/lib/domain/planilha";
import { retrySheetAction } from "./actions";
import { HiddenFieldsButton } from "./forms";

type LineSheet = {
  id: string;
  pending: boolean;
  error: string | null;
  syncedAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

const fmt = (d: Date | string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(d));

/** Situação da escrita na planilha do gestor (pedido e edição de linha). */
export function SheetStatus({
  line,
  now,
  canRetry,
  writing = "escrevendo…",
}: {
  line: LineSheet;
  now: Date;
  canRetry: boolean;
  writing?: string;
}) {
  const state: SheetWriteState = sheetWriteState(line, now);
  const retry = canRetry ? <HiddenFieldsButton action={retrySheetAction} fields={{ lineId: line.id }} label="Tentar de novo" /> : null;
  switch (state) {
    case "erro":
      return (
        <div className="space-y-2">
          <p className="rounded-lg bg-red-50 p-2 text-danger">
            Planilha: {line.error}
            {line.pending && <span className="block text-xs">Continua na fila: a rotina tenta de novo a cada 10 minutos.</span>}
          </p>
          {retry}
        </div>
      );
    case "escrevendo":
      return (
        <>
          <AutoRefresh seconds={3} />
          <p className="text-muted">Planilha: {writing} (a página atualiza sozinha)</p>
        </>
      );
    case "na_fila":
      return (
        <div className="space-y-2">
          <p className="rounded-lg bg-amber-50 p-2 text-amber-800">
            Planilha: na fila — a rotina tenta de novo em até 10 minutos. Se continuar assim, clique em “Tentar de novo” para ver o motivo.
          </p>
          {retry}
        </div>
      );
    case "ok":
      return <p className="text-success">Planilha do gestor preenchida ✓{line.syncedAt ? ` (${fmt(line.syncedAt)})` : ""}</p>;
    default:
      return null;
  }
}

/** Selo curto para a tabela de linhas. */
export function sheetBadge(state: SheetWriteState): { label: string; className: string } | null {
  if (state === "escrevendo") return { label: "escrevendo na planilha…", className: "text-muted" };
  if (state === "na_fila") return { label: "planilha: na fila", className: "text-amber-700" };
  if (state === "erro") return { label: "planilha: erro (veja acima)", className: "text-danger" };
  return null;
}

"use client";

import { useActionState } from "react";
import { FIELD_LABEL, SHEET_FIELDS, type ColumnNames, type SheetField } from "@/lib/domain/planilha";
import type { FormState } from "../actions";

type Action = (p: FormState, fd: FormData) => Promise<FormState>;

/** Exemplo de nome que o sistema já reconhece sozinho, para o placeholder. */
const AUTO: Record<SheetField, string> = {
  cliente: "Cliente", login: "Login", numero: "Número", iccid: "ICCID", smart: "Smart-Dados", plano: "Plano PJ",
  ativacao: "Ativação", venda: "Venda final", valor: "Valor", vencimento: "Vencimento", pagamento: "Forma de pagamento",
};

export function ColumnNamesForm({ action, initial }: { action: Action; initial: ColumnNames }) {
  const [s, a, pending] = useActionState(action, {});
  return (
    <form action={a} className="rp">
      <div className="cn-grid">
        {SHEET_FIELDS.map((f) => (
          <label key={f} className="rp-field">
            <span>{FIELD_LABEL[f]}</span>
            <input name={f} defaultValue={initial[f] ?? ""} placeholder={`Automático (ex.: ${AUTO[f]})`} maxLength={120} />
          </label>
        ))}
      </div>
      {s.message && (
        <p role="alert" className={`rounded-xl p-3 text-sm ${s.ok ? "bg-green-50 text-success" : "bg-red-50 text-danger"}`}>{s.message}</p>
      )}
      <div className="rp-actions">
        <button disabled={pending} className="rp-save">{pending ? "Salvando..." : "Salvar nomes"}</button>
      </div>
    </form>
  );
}

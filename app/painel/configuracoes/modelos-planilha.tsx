"use client";

import { useActionState, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { WRITABLE_FIELDS, type SheetField } from "@/lib/domain/planilha";
import {
  DEFAULT_TEMPLATES,
  EXAMPLE_CONTEXT,
  TAGS,
  renderTemplate,
  unknownTags,
  type Templates,
} from "@/lib/domain/planilha-modelos";
import type { FormState } from "../actions";

type Action = (p: FormState, fd: FormData) => Promise<FormState>;

const LABEL: Partial<Record<SheetField, string>> = {
  cliente: "Cliente", iccid: "ICCID", smart: "Smart-Dados", ativacao: "Ativação", venda: "Venda final", valor: "Valor (gestor)",
  vencimento: "Vencimento",
};

export function TemplatesForm({ action, initial }: { action: Action; initial: Templates }) {
  const [s, a, pending] = useActionState(action, {});
  const [tpl, setTpl] = useState<Templates>(initial);
  const [focus, setFocus] = useState<SheetField>("cliente");
  const refs = useRef<Partial<Record<SheetField, HTMLInputElement | null>>>({});

  const inserir = (label: string) => {
    const el = refs.current[focus];
    const cur = tpl[focus] ?? "";
    const tag = `[${label}]`;
    const at = el?.selectionStart ?? cur.length;
    const end = el?.selectionEnd ?? at;
    const next = cur.slice(0, at) + tag + cur.slice(end);
    setTpl((t) => ({ ...t, [focus]: next }));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + tag.length, at + tag.length);
    });
  };

  return (
    <form action={a} className="rp">
      <div className="mt-tags" aria-label="Etiquetas">
        <span>Clique para colocar na coluna “{LABEL[focus]}”:</span>
        {TAGS.map((t) => (
          <button key={t.key} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => inserir(t.label)}>
            [{t.label}]
          </button>
        ))}
      </div>
      <div className="mt-list">
        {WRITABLE_FIELDS.map((f) => {
          const v = tpl[f] ?? "";
          const bad = unknownTags(v);
          const preview = v ? renderTemplate(v, EXAMPLE_CONTEXT, "pt_BR").replace(/^'/, "") : "";
          return (
            <div key={f} className={`mt-row ${focus === f ? "is-focus" : ""}`}>
              <label className="rp-field">
                <span>{LABEL[f]}</span>
                <input
                  ref={(el) => {
                    refs.current[f] = el;
                  }}
                  name={f}
                  value={v}
                  maxLength={200}
                  onFocus={() => setFocus(f)}
                  onChange={(e) => setTpl((t) => ({ ...t, [f]: e.target.value }))}
                  placeholder={f === "cliente" ? "Obrigatório: tem que ter [Nome do cliente]" : "Em branco = não escreve nessa coluna"}
                />
              </label>
              <p className="mt-preview">
                {bad.length ? (
                  <span className="text-danger">Não conheço {bad.map((b) => `[${b}]`).join(", ")} — use os botões acima.</span>
                ) : v ? (
                  <>
                    Fica assim: <b>{preview}</b>
                  </>
                ) : (
                  <span className="text-muted">Não escreve nada nessa coluna.</span>
                )}
                {v !== (DEFAULT_TEMPLATES[f] ?? "") && (
                  <button type="button" className="mt-undo" onClick={() => setTpl((t) => ({ ...t, [f]: DEFAULT_TEMPLATES[f] ?? "" }))}>
                    <RotateCcw size={12} /> padrão
                  </button>
                )}
              </p>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted">Exemplo da prévia: Beatriz Rocha, pedido 8, ativada em 20/11/2026.</p>
      {s.message && (
        <p role="alert" className={`rounded-xl p-3 text-sm ${s.ok ? "bg-green-50 text-success" : "bg-red-50 text-danger"}`}>{s.message}</p>
      )}
      <div className="rp-actions">
        <button disabled={pending} className="rp-save">{pending ? "Salvando..." : "Salvar"}</button>
        <button
          type="button"
          className="rp-reset"
          onClick={() => {
            if (window.confirm("Voltar tudo ao padrão? (só muda na tela; clique em Salvar para valer)")) setTpl({ ...DEFAULT_TEMPLATES });
          }}
        >
          <RotateCcw size={15} /> Voltar tudo ao padrão
        </button>
      </div>
    </form>
  );
}

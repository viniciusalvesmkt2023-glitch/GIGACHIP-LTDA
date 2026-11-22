"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Plus, RotateCcw, Trash2 } from "lucide-react";
import {
  DEFAULT_RULES,
  EVENT_LABEL,
  RULE_COLORS,
  RULE_EVENTS,
  type RuleColor,
  type RuleEvent,
  type SheetRule,
} from "@/lib/domain/planilha-regras";
import type { FormState } from "../actions";

type Action = (p: FormState, fd: FormData) => Promise<FormState>;
type Draft = SheetRule & { key: number };

const COLUNAS = ["Gestor", "Cliente", "Smart-Dados", "ICCID", "Ativação", "Venda final", "Vencimento", "Status", "Observação"];
let seq = 0;
const draft = (r: SheetRule): Draft => ({ ...r, key: ++seq });
const vazia = (quando: RuleEvent): Draft => draft({ quando, coluna: "", escrever: null, corTexto: null, corFundo: null, seValor: null });

function Cor({ value, onChange, label }: { value: RuleColor | null; onChange: (c: RuleColor | null) => void; label: string }) {
  return (
    <label className="rp-field">
      <span>{label}</span>
      <span className="rp-color">
        <i style={{ background: value ? RULE_COLORS[value].hex : "transparent" }} className={value ? "" : "is-none"} aria-hidden="true" />
        <select value={value ?? ""} onChange={(e) => onChange((e.target.value || null) as RuleColor | null)}>
          <option value="">Não mudar</option>
          {(Object.keys(RULE_COLORS) as RuleColor[]).map((c) => (
            <option key={c} value={c}>{RULE_COLORS[c].label}</option>
          ))}
        </select>
      </span>
    </label>
  );
}

/** Frase do que a regra faz, para conferir antes de salvar. */
function frase(r: SheetRule): string {
  if (!r.coluna) return "Escreva o nome da coluna.";
  const partes: string[] = [];
  if (r.escrever) partes.push(`escrever “${r.escrever}”`);
  if (r.corTexto) partes.push(`deixar o texto ${RULE_COLORS[r.corTexto].label.toLowerCase()}`);
  if (r.corFundo) partes.push(`pintar o fundo de ${RULE_COLORS[r.corFundo].label.toLowerCase()}`);
  if (!partes.length) return "Diga o que fazer: um texto novo ou uma cor.";
  const se = r.seValor ? ` — só se estiver escrito ${r.seValor.split(";").map((v) => `“${v.trim()}”`).filter((v) => v !== "“”").join(" ou ")}` : "";
  return `Na coluna “${r.coluna}”: ${partes.join(", ")}${se}.`;
}

export function SheetRulesEditor({ action, initial }: { action: Action; initial: SheetRule[] }) {
  const [s, a, pending] = useActionState(action, {});
  const [rules, setRules] = useState<Draft[]>(() => initial.map(draft));
  const set = (key: number, patch: Partial<SheetRule>) => setRules((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const text = (v: string) => (v.trim() ? v : null);
  const payload = JSON.stringify(rules.map((d) => ({ quando: d.quando, coluna: d.coluna, escrever: d.escrever, corTexto: d.corTexto, corFundo: d.corFundo, seValor: d.seValor })));

  return (
    <form action={a} className="rp">
      <input type="hidden" name="rules" value={payload} />
      {RULE_EVENTS.map((ev) => {
        const lista = rules.filter((r) => r.quando === ev);
        return (
          <section key={ev} className="rp-group">
            <h3>{EVENT_LABEL[ev]}</h3>
            {lista.length === 0 && <p className="rp-empty">Nenhuma regra — a planilha não muda nesse momento.</p>}
            {lista.map((r) => (
              <div key={r.key} className="rp-rule">
                <div className="rp-grid">
                  <label className="rp-field">
                    <span>Coluna</span>
                    <input value={r.coluna} onChange={(e) => set(r.key, { coluna: e.target.value })} list="rp-colunas" placeholder="Ex.: Gestor" maxLength={60} />
                  </label>
                  <label className="rp-field">
                    <span>Só se estiver escrito <em>(opcional)</em></span>
                    <input
                      value={r.seValor ?? ""}
                      onChange={(e) => set(r.key, { seValor: text(e.target.value) })}
                      placeholder="Em branco = sempre"
                      maxLength={200}
                    />
                  </label>
                  <ArrowRight size={18} className="rp-arrow" aria-hidden="true" />
                  <label className="rp-field">
                    <span>Escrever</span>
                    <input value={r.escrever ?? ""} onChange={(e) => set(r.key, { escrever: text(e.target.value) })} placeholder="Em branco = não muda" maxLength={100} />
                  </label>
                  <Cor label="Cor do texto" value={r.corTexto} onChange={(c) => set(r.key, { corTexto: c })} />
                  <Cor label="Cor do fundo" value={r.corFundo} onChange={(c) => set(r.key, { corFundo: c })} />
                  <button type="button" className="rp-del" onClick={() => setRules((rs) => rs.filter((x) => x.key !== r.key))} aria-label="Apagar esta regra" title="Apagar regra">
                    <Trash2 size={16} /> <span>Apagar regra</span>
                  </button>
                </div>
                <p className="rp-frase">{frase(r)}</p>
              </div>
            ))}
            <button type="button" className="rp-add" onClick={() => setRules((rs) => [...rs, vazia(ev)])}>
              <Plus size={16} /> Adicionar regra
            </button>
          </section>
        );
      })}
      <datalist id="rp-colunas">
        {COLUNAS.map((c) => <option key={c} value={c} />)}
      </datalist>

      {s.message && (
        <p role="alert" className={`rounded-xl p-3 text-sm ${s.ok ? "bg-green-50 text-success" : "bg-red-50 text-danger"}`}>{s.message}</p>
      )}
      <div className="rp-actions">
        <button disabled={pending} className="rp-save">{pending ? "Salvando..." : "Salvar regras"}</button>
        <button
          type="button"
          className="rp-reset"
          onClick={() => {
            if (window.confirm("Voltar às regras de fábrica? (só muda na tela; clique em Salvar para valer)")) setRules(DEFAULT_RULES.map(draft));
          }}
        >
          <RotateCcw size={15} /> Voltar ao padrão
        </button>
      </div>
    </form>
  );
}

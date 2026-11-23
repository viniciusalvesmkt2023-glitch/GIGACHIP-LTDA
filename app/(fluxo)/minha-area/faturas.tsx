"use client";

/* eslint-disable @next/next/no-img-element -- QR Code em base64 gerado pelo Asaas */
import { useState, useTransition } from "react";
import { Check, Copy, ExternalLink, LoaderCircle, QrCode, ScanLine } from "lucide-react";
import { formatBRL } from "@/lib/domain/money";
import type { Fatura } from "@/lib/server/customer-area";
import { pixDaFaturaAction, type PixState } from "./actions";

const data = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

function situacao(f: Fatura, hoje: string): { label: string; tone: string; aberta: boolean } {
  if (f.status === "confirmed" || f.status === "received") return { label: "Paga", tone: "green", aberta: false };
  if (f.status === "refunded") return { label: "Estornada", tone: "gray", aberta: false };
  if (f.status === "chargeback") return { label: "Contestada", tone: "gray", aberta: false };
  if (f.status === "overdue" || f.dueDate < hoje) return { label: "Vencida", tone: "red", aberta: true };
  return { label: "Em aberto", tone: "amber", aberta: true };
}

function Pagar({ f, cartao }: { f: Fatura; cartao: boolean }) {
  const [pix, setPix] = useState<PixState | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [pending, start] = useTransition();

  if (cartao) {
    return f.invoiceUrl ? (
      <a href={f.invoiceUrl} target="_blank" rel="noopener noreferrer" className="ck-btn cl-pay-btn">
        Pagar com cartão <ExternalLink size={16} />
      </a>
    ) : null;
  }
  if (!pix?.ok) {
    return (
      <div className="cl-pay">
        <button type="button" className="ck-btn cl-pay-btn" disabled={pending} onClick={() => start(async () => setPix(await pixDaFaturaAction(f.id)))}>
          {pending ? <><LoaderCircle size={16} className="animate-spin" /> Gerando PIX...</> : <><QrCode size={16} /> Pagar com PIX</>}
        </button>
        {pix?.message && <p className="ck-error">{pix.message}</p>}
        {(pix?.invoiceUrl ?? f.invoiceUrl) && pix && (
          <a href={pix.invoiceUrl ?? f.invoiceUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="ac-link">
            Outras formas de pagar
          </a>
        )}
      </div>
    );
  }
  return (
    <div className="cl-pix">
      <div className="cl-pix-qr">
        <img src={`data:image/png;base64,${pix.image}`} alt="QR Code do PIX" width={170} height={170} />
        <span>
          <ScanLine size={13} /> Escaneie no app do banco
        </span>
      </div>
      <div className="cl-pix-side">
        <span className="pg-copy-label">Pix copia e cola</span>
        <code>{pix.payload}</code>
        <button
          type="button"
          className={`ck-btn pg-copy-btn ${copiado ? "is-copied" : ""}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(pix.payload ?? "");
            } catch {
              /* o código continua visível */
            }
            setCopiado(true);
            window.setTimeout(() => setCopiado(false), 2500);
          }}
        >
          {copiado ? <Check size={16} /> : <Copy size={16} />} {copiado ? "Código copiado!" : "Copiar código PIX"}
        </button>
        <p className="cl-pix-note">Depois de pagar, a fatura aparece como paga em alguns minutos.</p>
        {pix.invoiceUrl && (
          <a href={pix.invoiceUrl} target="_blank" rel="noopener noreferrer" className="ac-link">
            Outras formas de pagar (boleto)
          </a>
        )}
      </div>
    </div>
  );
}

export function Faturas({ faturas, hoje, cartao }: { faturas: Fatura[]; hoje: string; cartao: boolean }) {
  if (!faturas.length) return <p className="ck-sub">Nenhuma fatura ainda.</p>;
  return (
    <ul className="cl-faturas">
      {faturas.map((f) => {
        const s = situacao(f, hoje);
        return (
          <li key={f.id} className={`cl-fatura ${s.aberta ? "is-open" : ""}`}>
            <div className="cl-fatura-top">
              <span>
                <b>{formatBRL(f.amountCents)}</b>
                <small>
                  {f.first ? "1ª mensalidade" : "Mensalidade"} · vence {data(f.dueDate)}
                  {f.paidAt && ` · paga em ${f.paidAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`}
                </small>
              </span>
              <span className={`cl-tag is-${s.tone}`}>{s.label}</span>
            </div>
            {s.aberta && <Pagar f={f} cartao={cartao} />}
          </li>
        );
      })}
    </ul>
  );
}

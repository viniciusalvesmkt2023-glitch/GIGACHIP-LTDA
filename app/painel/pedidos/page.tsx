import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, FileSignature, IdCard, Search, Smartphone } from "lucide-react";
import { shortOrderNumber } from "@/lib/domain/money";
import { listOrders, orderStatusCounts, STATUS_LABEL } from "@/lib/server/admin";
import { requireStaff } from "@/lib/server/staff-auth";
import { PanelShell, PanelLoading } from "../shell";
import { StatusBadge } from "../status-badge";

export const metadata: Metadata = { title: "Pedidos" };

/** Filtros rápidos (na ordem do dia a dia). */
const CHIPS: { status: string; label: string }[] = [
  { status: "pronto_para_ativacao", label: "Prontos para ativar" },
  { status: "em_andamento", label: "Cliente concluindo" },
  { status: "aguardando_pagamento", label: "Aguardando pagamento" },
  { status: "pendencia", label: "Pendência" },
  { status: "ativado", label: "Ativados" },
  { status: "expirado", label: "Expirados" },
];

/** Etapa do cliente: ok / esperando / problema / ainda não. */
function etapa(v: string): "ok" | "wait" | "bad" | "none" {
  if (["approved", "signed", "confirmed"].includes(v)) return "ok";
  if (["in_review", "pending_documents", "sent", "queued", "submitted"].includes(v)) return "wait";
  if (["rejected", "error", "retry_required", "refused", "invalid"].includes(v)) return "bad";
  return "none";
}
const ETAPA_TXT = { ok: "feito", wait: "aguardando", bad: "com problema", none: "ainda não" } as const;

const quando = (d: Date) =>
  d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

async function Content({ searchParams }: { searchParams: PageProps<"/painel/pedidos">["searchParams"] }) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const status = typeof sp.status === "string" && STATUS_LABEL[sp.status] ? sp.status : undefined;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const identidade = sp.identidade === "1";
  const [orders, counts] = await Promise.all([listOrders(staff, { status, q, identityReview: identidade }), orderStatusCounts(staff)]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const href = (s?: string) => {
    const u = new URLSearchParams();
    if (s) u.set("status", s);
    if (q) u.set("q", q);
    const t = u.toString();
    return `/painel/pedidos${t ? `?${t}` : ""}`;
  };

  return (
    <PanelShell staff={staff}>
      <div className="pn-head">
        <h1>Pedidos</h1>
        <p>{total} pedidos no total{identidade ? " · mostrando só identidades para analisar" : ""}</p>
      </div>

      <form className="pd-search">
        <Search size={18} aria-hidden="true" />
        <input name="q" defaultValue={q} placeholder="Buscar por número, nome ou e-mail" aria-label="Buscar pedidos" />
        {status && <input type="hidden" name="status" value={status} />}
        <button>Buscar</button>
      </form>

      <div className="pd-chips" role="group" aria-label="Filtrar por status">
        <Link href={href()} className={`sc-chip ${!status && !identidade ? "is-on" : ""}`}>
          Todos <em>{total}</em>
        </Link>
        {CHIPS.map((c) => (
          <Link key={c.status} href={href(c.status)} className={`sc-chip ${status === c.status ? "is-on" : ""} ${c.status === "pronto_para_ativacao" && counts[c.status] ? "is-hot" : ""}`}>
            {c.label} <em>{counts[c.status] ?? 0}</em>
          </Link>
        ))}
      </div>

      <div className="pd-list">
        <div className="pd-row pd-row-head" aria-hidden="true">
          <span>Pedido</span>
          <span>Cliente</span>
          <span>Status</span>
          <span>Etapas do cliente</span>
          <span>Criado</span>
          <span />
        </div>
        {orders.map((o) => {
          const steps = [
            { k: "Aparelho/chip", v: etapa(o.deviceStatus), Icon: Smartphone },
            { k: "Contrato", v: etapa(o.contractStatus), Icon: FileSignature },
            { k: "Identidade", v: etapa(o.identityStatus), Icon: IdCard },
          ];
          return (
            <Link key={o.id} href={`/painel/pedidos/${o.id}`} className={`pd-row ${o.status === "pronto_para_ativacao" ? "is-hot" : ""}`}>
              <span className="pd-code">
                {shortOrderNumber(o.code)}
              </span>
              <span className="pd-client">
                <strong>{o.customerName}</strong>
                <small>
                  {o.planName} · {o.simType === "esim" ? "eSIM" : "Chip físico"}
                </small>
              </span>
              <span>
                <StatusBadge status={o.status} />
              </span>
              <span className="pd-steps">
                {steps.map(({ k, v, Icon }) => (
                  <i key={k} className={`is-${v}`} title={`${k}: ${ETAPA_TXT[v]}`} aria-label={`${k}: ${ETAPA_TXT[v]}`}>
                    <Icon size={14} />
                  </i>
                ))}
              </span>
              <span className="pd-date">{quando(o.createdAt)}</span>
              <ChevronRight size={18} className="pd-go" aria-hidden="true" />
            </Link>
          );
        })}
        {orders.length === 0 && <p className="pd-empty">Nenhum pedido encontrado.</p>}
      </div>
    </PanelShell>
  );
}

export default function PedidosPage({ searchParams }: PageProps<"/painel/pedidos">) {
  return (
    <Suspense fallback={<PanelLoading />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

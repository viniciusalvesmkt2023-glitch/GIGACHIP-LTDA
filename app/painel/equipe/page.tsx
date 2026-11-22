import type { Metadata } from "next";
import { Suspense } from "react";
import { ShieldCheck, ShieldAlert, UserPlus } from "lucide-react";
import { sql } from "@/lib/server/db";
import { requireStaff } from "@/lib/server/staff-auth";
import { createStaffAction } from "../actions";
import { NewStaffForm } from "../forms";
import { PanelShell, PanelLoading } from "../shell";

export const metadata: Metadata = { title: "Equipe" };

/** O que cada função pode fazer no painel (conferido com as permissões do código). */
const FUNCOES: Record<string, { label: string; tone: string; pode: string }> = {
  owner: { label: "Dono", tone: "blue", pode: "Tudo, inclusive Equipe, Integrações e Configurações." },
  admin: { label: "Administrador", tone: "green", pode: "Pedidos, ativar linhas, Linhas (editar e adicionar números), Inadimplência e baixar o Excel." },
  ativador: { label: "Ativador", tone: "amber", pode: "Ativar linhas, ver os dados do cliente para ativar, bloquear e desbloquear." },
  financeiro: { label: "Financeiro", tone: "gray", pode: "Ver pedidos, linhas e inadimplência e baixar o Excel (sem ativar nem bloquear)." },
  atendente: { label: "Atendente", tone: "gray", pode: "Ver pedidos e linhas, sem dados sensíveis e sem ativar." },
};

const iniciais = (nome: string) =>
  nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";

const quando = (d: Date | null) =>
  d ? d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "nunca entrou";

async function Content() {
  const staff = await requireStaff(["owner"]);
  const team = await sql()<{ id: string; name: string; email: string; role: string; is_active: boolean; has_2fa: boolean; last_login_at: Date | null }[]>`
    select id, name, email::text as email, role::text, is_active, (totp_secret_encrypted is not null) as has_2fa, last_login_at
    from public.staff order by is_active desc, created_at`;
  const ativos = team.filter((t) => t.is_active).length;

  return (
    <PanelShell staff={staff}>
      <div className="pn-head">
        <h1>Equipe</h1>
        <p>
          {ativos} {ativos === 1 ? "pessoa com acesso" : "pessoas com acesso"} ao painel · só o dono vê esta página
        </p>
      </div>

      <div className="pd-list eq-list">
        {team.map((t) => {
          const f = FUNCOES[t.role] ?? { label: t.role, tone: "gray", pode: "" };
          return (
            <div key={t.id} className={`eq-row ${t.is_active ? "" : "is-off"}`}>
              <span className={`eq-avatar is-${f.tone}`}>{iniciais(t.name)}</span>
              <div className="eq-main">
                <strong>
                  {t.name}
                  {t.id === staff.id && <em>você</em>}
                </strong>
                <small>{t.email}</small>
              </div>
              <div className="eq-role">
                <span className={`pd-badge is-${f.tone}`}>{f.label}</span>
                {!t.is_active && <span className="pd-badge is-muted">Sem acesso</span>}
              </div>
              <div className="eq-2fa">
                {t.has_2fa ? (
                  <span className="eq-ok"><ShieldCheck size={15} /> 2FA ativo</span>
                ) : (
                  <span className="eq-wait" title="Ainda não configurou o código do celular (entra pela primeira vez e configura)">
                    <ShieldAlert size={15} /> 2FA pendente
                  </span>
                )}
              </div>
              <div className="eq-last">
                <span>Último acesso</span>
                <b>{quando(t.last_login_at)}</b>
              </div>
            </div>
          );
        })}
      </div>

      <div className="eq-grid">
        <section className="pn-card">
          <h2 className="pn-card-title eq-title">
            <UserPlus size={18} /> Adicionar pessoa
          </h2>
          <p className="mb-3 text-sm text-muted">
            Passe a senha inicial para a pessoa por um canal seguro. No primeiro acesso ela configura o código do celular
            (2FA), que é obrigatório.
          </p>
          <NewStaffForm action={createStaffAction} />
        </section>
        <section className="pn-card">
          <h2 className="pn-card-title">O que cada função pode fazer</h2>
          <ul className="eq-funcs">
            {Object.entries(FUNCOES).map(([k, f]) => (
              <li key={k}>
                <span className={`pd-badge is-${f.tone}`}>{f.label}</span>
                <p>{f.pode}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PanelShell>
  );
}

export default function EquipePage() {
  return (
    <Suspense fallback={<PanelLoading />}>
      <Content />
    </Suspense>
  );
}

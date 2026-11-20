import type { Metadata } from "next";
import { Suspense } from "react";
import { sql } from "@/lib/server/db";
import { requireStaff } from "@/lib/server/staff-auth";
import { createStaffAction } from "../actions";
import { NewStaffForm } from "../forms";
import { Card, PanelShell } from "../shell";

export const metadata: Metadata = { title: "Equipe" };

async function Content() {
  const staff = await requireStaff(["owner"]);
  const team = await sql()<{ name: string; email: string; role: string; is_active: boolean; has_2fa: boolean; last_login_at: Date | null }[]>`
    select name, email::text as email, role::text, is_active, (totp_secret_encrypted is not null) as has_2fa, last_login_at
    from public.staff order by created_at`;
  return (
    <PanelShell staff={staff}>
      <h1 className="text-2xl font-bold">Equipe</h1>
      <Card className="mt-4">
        <ul className="divide-y divide-border text-sm">
          {team.map((t) => (
            <li key={t.email} className="flex flex-wrap justify-between gap-2 py-2">
              <span><strong>{t.name}</strong> · {t.email}</span>
              <span className="text-muted">{t.role} · 2FA {t.has_2fa ? "ativo" : "pendente"} · último acesso {t.last_login_at?.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) ?? "nunca"}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Adicionar pessoa" className="mt-4"><NewStaffForm action={createStaffAction} /></Card>
    </PanelShell>
  );
}

export default function EquipePage() {
  return <Suspense fallback={<div className="p-8">Carregando…</div>}><Content /></Suspense>;
}

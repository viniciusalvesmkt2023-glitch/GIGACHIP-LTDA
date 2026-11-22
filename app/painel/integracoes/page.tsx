import type { Metadata } from "next";
import { Suspense } from "react";
import { CircleCheck, CircleX, CreditCard, Database, FileSignature, FileSpreadsheet, Mail, MessageCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import { d4signBudget, d4signConfigured } from "@/lib/integrations/d4sign/client";
import { env } from "@/lib/server/env";
import { WHATSAPP_NUMBER } from "@/components/whatsapp";
import { formatWhatsapp } from "@/lib/contract/settings";
import { serviceAccountEmail, sheetsConfigured } from "@/lib/integrations/google/sheets";
import { getSheetConfig } from "@/lib/server/planilha";
import { pendingMigrations } from "@/lib/server/schema-check";
import { requireStaff } from "@/lib/server/staff-auth";
import { listSafesAction, testSheetAction } from "../actions";
import { ActionButton } from "../forms";
import { PanelShell } from "../shell";

export const metadata: Metadata = { title: "Integrações" };

type Item = { label: string; ok: boolean; hint?: string };

/** Mostra só se a chave existe — o valor nunca aparece na tela. */
function Servico({ icon: Icon, nome, para, itens, extra, children, modo }: {
  icon: LucideIcon; nome: string; para: string; itens: Item[]; extra?: React.ReactNode; children?: React.ReactNode; modo?: { label: string; tone: string };
}) {
  const tudo = itens.every((i) => i.ok);
  return (
    <section className={`ig-card ${tudo ? "is-ok" : "is-bad"}`}>
      <header>
        <span className="ig-icon"><Icon size={20} /></span>
        <div>
          <h2>{nome}</h2>
          <p>{para}</p>
        </div>
        <span className={`pd-badge ${tudo ? "is-green" : "is-red"}`}>{tudo ? "Configurado" : "Falta configurar"}</span>
      </header>
      {modo && <span className={`pd-badge is-${modo.tone} ig-mode`}>{modo.label}</span>}
      <ul className="ig-items">
        {itens.map((i) => (
          <li key={i.label} className={i.ok ? "is-ok" : "is-bad"}>
            {i.ok ? <CircleCheck size={16} /> : <CircleX size={16} />}
            <span>
              {i.label}
              {i.hint && <small>{i.hint}</small>}
            </span>
          </li>
        ))}
      </ul>
      {extra}
      {children && <div className="ig-actions">{children}</div>}
    </section>
  );
}

async function Content() {
  const staff = await requireStaff(["owner"]);
  const e = env();
  const configured = d4signConfigured();
  const budget = configured ? await d4signBudget() : null;
  const robot = serviceAccountEmail();
  const [sheet, migrations] = await Promise.all([getSheetConfig(), pendingMigrations()]);
  const asaasHost = (() => {
    try {
      return new URL(e.ASAAS_API_URL).hostname;
    } catch {
      return "";
    }
  })();
  const asaasModo =
    ["api.asaas.com", "www.asaas.com"].includes(asaasHost) ? { label: "Produção — cobranças reais", tone: "green" }
    : /sandbox/i.test(asaasHost) ? { label: "Modo de teste (sandbox) — nenhuma cobrança é real", tone: "amber" }
    : { label: "Servidor de teste — nenhuma cobrança é real", tone: "amber" };
  const whats = WHATSAPP_NUMBER;

  return (
    <PanelShell staff={staff}>
      <div className="pn-head">
        <h1>Integrações</h1>
        <p>
          Serviços que o sistema usa. As chaves ficam guardadas na Vercel — aqui só aparece se existem, nunca o valor.
          “Configurado” quer dizer que as chaves estão lá; para conferir se funcionam, use os botões de teste.
        </p>
      </div>

      {migrations.length > 0 ? (
        <section className="ln-alert ig-db" role="alert">
          <p className="ln-alert-title">
            <TriangleAlert size={18} /> Migração pendente no banco
          </p>
          <p className="mt-1 text-sm">
            Partes do sistema vão falhar até isso ser aplicado (ex.: a escrita na planilha fica “na fila”). Abra o{" "}
            <strong>Supabase → SQL Editor</strong>, cole o conteúdo de cada arquivo abaixo, <strong>na ordem</strong>, clique em Run e
            recarregue esta página.
          </p>
          <ul>
            {migrations.map((m) => (
              <li key={m.file}>
                <p>
                  <code className="select-all font-semibold">supabase/migrations/{m.file}</code>
                  <span>Falta: {m.missing.join(", ")}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="ig-dbok">
          <Database size={16} /> Banco atualizado: todas as migrações recentes foram aplicadas.
        </p>
      )}

      <div className="ig-grid">
        <Servico
          icon={CreditCard}
          nome="Asaas"
          para="Pagamentos (PIX e cartão) e cobranças mensais"
          modo={asaasModo}
          itens={[
            { label: "Chave da API", ok: Boolean(e.ASAAS_API_KEY), hint: "ASAAS_API_KEY" },
            { label: "Senha do aviso de pagamento (webhook)", ok: Boolean(e.ASAAS_WEBHOOK_TOKEN), hint: "ASAAS_WEBHOOK_TOKEN" },
          ]}
        />

        <Servico
          icon={FileSignature}
          nome="D4Sign"
          para="Contrato no e-mail, com documento e selfie"
          itens={[
            { label: "Chaves", ok: configured, hint: "D4SIGN_TOKEN_API e D4SIGN_CRYPT_KEY" },
            { label: "Cofre dos contratos", ok: Boolean(e.D4SIGN_SAFE_UUID), hint: "D4SIGN_SAFE_UUID" },
            { label: "Senha do aviso de assinatura", ok: Boolean(e.D4SIGN_WEBHOOK_SECRET), hint: "D4SIGN_WEBHOOK_SECRET" },
          ]}
          extra={
            budget !== null && (
              <div className="ig-meter">
                <span>Chamadas livres na última hora</span>
                <b>{budget} de {e.D4SIGN_RATE_LIMIT_PER_HOUR}</b>
                <i><em style={{ width: `${Math.min(100, (budget / e.D4SIGN_RATE_LIMIT_PER_HOUR) * 100)}%` }} /></i>
              </div>
            )
          }
        >
          {configured && (
            <>
              <p className="ig-help">Descobre o código do cofre onde os contratos são criados. Gasta 1 chamada da D4Sign.</p>
              <ActionButton action={listSafesAction} label="Listar meus cofres" />
            </>
          )}
        </Servico>

        <Servico
          icon={FileSpreadsheet}
          nome="Google Planilhas"
          para="Planilha do gestor: lê os números e escreve as vendas"
          itens={[
            { label: "Usuário robô", ok: sheetsConfigured(), hint: "GOOGLE_SERVICE_ACCOUNT_JSON" },
            { label: "Link da planilha", ok: Boolean(sheet), hint: "em Configurações" },
          ]}
          extra={
            robot && (
              <div className="ig-robot">
                <span>Compartilhe a planilha com este e-mail como <b>Editor</b>:</span>
                <code className="select-all">{robot}</code>
              </div>
            )
          }
        >
          {sheetsConfigured() && sheet && (
            <>
              <p className="ig-help">Confere se o robô abre a planilha e quais colunas achou. Só lê; não altera nada.</p>
              <ActionButton action={testSheetAction} label="Testar planilha" />
            </>
          )}
        </Servico>

        <Servico
          icon={Mail}
          nome="E-mails (Resend)"
          para="Confirmação de compra, link de ativação e recuperação de senha"
          itens={[
            { label: "Chave do Resend", ok: Boolean(process.env.RESEND_API_KEY), hint: "RESEND_API_KEY" },
            { label: "Remetente", ok: Boolean(process.env.EMAIL_FROM), hint: process.env.EMAIL_FROM ? process.env.EMAIL_FROM : "EMAIL_FROM" },
          ]}
        />

        <Servico
          icon={MessageCircle}
          nome="WhatsApp"
          para="Botão do cliente para pedir a ativação e atendimento no contrato"
          itens={[{ label: "Número de atendimento", ok: Boolean(whats), hint: whats ? `+55 ${formatWhatsapp(whats) ?? whats}` : "NEXT_PUBLIC_WHATSAPP_NUMBER" }]}
        />
      </div>
    </PanelShell>
  );
}

export default function IntegracoesPage() {
  return (
    <Suspense fallback={<div className="p-8">Carregando…</div>}>
      <Content />
    </Suspense>
  );
}

"use client";

import { useActionState } from "react";
import { buttonStyles } from "@/components/ui";
import type { FormState } from "./actions";

type Action = (p: FormState, fd: FormData) => Promise<FormState>;

const input = "mt-1 w-full rounded-xl border border-border bg-white px-4 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30";

function Msg({ s }: { s: FormState }) {
  if (!s.message) return null;
  return <p role="alert" className={`rounded-xl p-3 text-sm ${s.ok ? "bg-green-50 text-success" : "bg-red-50 text-danger"}`}>{s.message}</p>;
}

export function LoginForm({ action }: { action: Action }) {
  const [s, a, pending] = useActionState(action, {});
  return (
    <form action={a} className="space-y-4">
      <Msg s={s} />
      <label className="block text-sm font-medium">E-mail<input name="email" type="email" autoComplete="username" required defaultValue={s.email} className={input} /></label>
      <label className="block text-sm font-medium">Senha<input name="password" type="password" autoComplete="current-password" required className={input} /></label>
      <button disabled={pending} className={`${buttonStyles.primary} w-full`}>{pending ? "Entrando..." : "Entrar"}</button>
    </form>
  );
}

export function TotpForm({ action }: { action: Action }) {
  const [s, a, pending] = useActionState(action, {});
  return (
    <form action={a} className="space-y-4">
      <Msg s={s} />
      <label className="block text-sm font-medium">
        Código de 6 números do aplicativo
        <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required className={`${input} text-center font-mono text-2xl tracking-[0.5em]`} />
      </label>
      <button disabled={pending} className={`${buttonStyles.primary} w-full`}>{pending ? "Conferindo..." : "Confirmar"}</button>
    </form>
  );
}

export function SetupForm({ action }: { action: Action }) {
  const [s, a, pending] = useActionState(action, {});
  return (
    <form action={a} className="space-y-4">
      <Msg s={s} />
      <label className="block text-sm font-medium">Código de configuração<input name="setupToken" type="password" required className={input} /></label>
      <label className="block text-sm font-medium">Seu nome<input name="name" required className={input} /></label>
      <label className="block text-sm font-medium">E-mail<input name="email" type="email" required className={input} /></label>
      <label className="block text-sm font-medium">Senha (12+ caracteres, letras e números)<input name="password" type="password" autoComplete="new-password" required className={input} /></label>
      <button disabled={pending} className={`${buttonStyles.primary} w-full`}>{pending ? "Criando..." : "Criar acesso de dono"}</button>
    </form>
  );
}

export function NewStaffForm({ action }: { action: Action }) {
  const [s, a, pending] = useActionState(action, {});
  return (
    <form action={a} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><Msg s={s} /></div>
      <label className="text-sm font-medium">Nome<input name="name" required className={input} /></label>
      <label className="text-sm font-medium">E-mail<input name="email" type="email" required className={input} /></label>
      <label className="text-sm font-medium">Senha inicial<input name="password" type="password" autoComplete="new-password" required className={input} /></label>
      <label className="text-sm font-medium">Função
        <select name="role" className={input} defaultValue="ativador">
          <option value="admin">Administrador</option>
          <option value="ativador">Ativador</option>
          <option value="atendente">Atendente</option>
          <option value="financeiro">Financeiro</option>
          <option value="owner">Dono</option>
        </select>
      </label>
      <button disabled={pending} className={`${buttonStyles.primary} sm:col-span-2`}>{pending ? "Salvando..." : "Adicionar à equipe"}</button>
    </form>
  );
}

export function RevealButton({ action, orderId, field, label }: { action: Action; orderId: string; field: string; label: string }) {
  const [s, a, pending] = useActionState(action, {});
  if (s.value) return <span className="font-mono">{s.value}</span>;
  return (
    <form action={a} className="inline">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="field" value={field} />
      <button disabled={pending} className="text-sm font-medium text-brand underline" title="Fica registrado na auditoria">
        {pending ? "..." : label}
      </button>
      {s.message && <span className="ml-2 text-xs text-muted">{s.message}</span>}
    </form>
  );
}

export function IdentityDecisionForm({ action, orderId }: { action: Action; orderId: string }) {
  const [s, a, pending] = useActionState(action, {});
  if (s.ok) return <Msg s={s} />;
  return (
    <form action={a} className="space-y-3">
      <Msg s={s} />
      <input type="hidden" name="orderId" value={orderId} />
      <label className="block text-sm font-medium">
        Motivo (só se for pedir novas fotos — o cliente verá este texto)
        <input name="reason" placeholder="Ex.: foto do documento está desfocada" className={input} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button name="decision" value="aprovar" disabled={pending} className={`${buttonStyles.primary} bg-success hover:bg-green-800`}>Aprovar identidade</button>
        <button name="decision" value="recusar" disabled={pending} className={buttonStyles.secondary}>Pedir novas fotos</button>
      </div>
    </form>
  );
}

/** Botão simples que chama uma ação do painel e mostra o resultado. */
export function ActionButton({ action, orderId, label, variant = "secondary" }: { action: Action; orderId?: string; label: string; variant?: "primary" | "secondary" }) {
  const [s, a, pending] = useActionState(action, {});
  return (
    <form action={a} className="space-y-2">
      {orderId && <input type="hidden" name="orderId" value={orderId} />}
      <button disabled={pending} className={`${buttonStyles[variant]} py-2`}>{pending ? "Aguarde..." : label}</button>
      <Msg s={s} />
      {s.value && <pre className="whitespace-pre-wrap rounded-xl bg-surface p-3 text-xs">{s.value}</pre>}
    </form>
  );
}

export function ChangeEmailForm({ action, orderId, current }: { action: Action; orderId: string; current: string }) {
  const [s, a, pending] = useActionState(action, {});
  return (
    <details className="mt-3 rounded-xl border border-border p-3 text-sm">
      <summary className="cursor-pointer font-medium text-brand">Corrigir e-mail do cliente</summary>
      <form action={a} className="mt-3 space-y-2">
        <input type="hidden" name="orderId" value={orderId} />
        <p className="text-xs text-muted">
          Antes de trocar, confirme com o cliente pelo celular cadastrado. Se o contrato ainda não foi assinado, o antigo é
          cancelado e um novo vai para o e-mail correto (usa 1 envio da D4Sign).
        </p>
        <input name="email" type="email" required defaultValue={current} className={input} />
        <button disabled={pending} className={`${buttonStyles.primary} py-2`}>{pending ? "Corrigindo..." : "Salvar e reenviar"}</button>
        <Msg s={s} />
      </form>
    </details>
  );
}

"use client";

import { useActionState, useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import type { FormState } from "./actions";

type Action = (p: FormState, fd: FormData) => Promise<FormState>;

export function AuthMsg({ s }: { s: FormState }) {
  if (!s.message) return null;
  return (
    <p role="alert" className={`au-msg ${s.ok ? "is-ok" : "is-bad"}`}>
      {s.ok ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
      {s.message}
    </p>
  );
}

function Submit({ pending, label, busy }: { pending: boolean; label: string; busy: string }) {
  return (
    <button disabled={pending} className="au-submit">
      {pending ? (
        <>
          <LoaderCircle size={19} className="animate-spin" /> {busy}
        </>
      ) : (
        <>
          {label} <ArrowRight size={19} />
        </>
      )}
    </button>
  );
}

function Senha({ name, label, autoComplete, minLength }: { name: string; label: string; autoComplete: string; minLength?: number }) {
  const [ver, setVer] = useState(false);
  return (
    <label className="au-field">
      {label}
      <span className="au-input has-eye">
        <LockKeyhole size={20} aria-hidden="true" />
        <input name={name} type={ver ? "text" : "password"} autoComplete={autoComplete} required minLength={minLength} placeholder={label === "Senha" ? "Sua senha" : "Mínimo de 12 caracteres"} />
        <button type="button" className="au-eye" onClick={() => setVer((v) => !v)} aria-label={ver ? "Esconder a senha" : "Mostrar a senha"}>
          {ver ? <EyeOff size={19} /> : <Eye size={19} />}
        </button>
      </span>
    </label>
  );
}

function Email({ defaultValue }: { defaultValue?: string }) {
  return (
    <label className="au-field">
      E-mail
      <span className="au-input">
        <Mail size={20} aria-hidden="true" />
        <input name="email" type="email" autoComplete="username" required defaultValue={defaultValue} placeholder="voce@gigachip.com.br" />
      </span>
    </label>
  );
}

export function AuthLoginForm({ action }: { action: Action }) {
  const [s, a, pending] = useActionState(action, {});
  return (
    <form action={a} className="au-form">
      <Email defaultValue={s.email} />
      <Senha name="password" label="Senha" autoComplete="current-password" />
      <AuthMsg s={s} />
      <Submit pending={pending} label="Entrar no painel" busy="Entrando..." />
    </form>
  );
}

export function AuthTotpForm({ action }: { action: Action }) {
  const [s, a, pending] = useActionState(action, {});
  return (
    <form action={a} className="au-form">
      <label className="au-field">
        Código de 6 números
        <span className="au-input au-code">
          <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus placeholder="000000" />
        </span>
      </label>
      <AuthMsg s={s} />
      <Submit pending={pending} label="Confirmar" busy="Conferindo..." />
    </form>
  );
}

export function AuthForgotForm({ action }: { action: Action }) {
  const [s, a, pending] = useActionState(action, {});
  if (s.ok) return <div className="au-form"><AuthMsg s={s} /></div>;
  return (
    <form action={a} className="au-form">
      <Email defaultValue={s.email} />
      <AuthMsg s={s} />
      <Submit pending={pending} label="Enviar link" busy="Enviando..." />
    </form>
  );
}

export function AuthResetForm({ action, token }: { action: Action; token: string }) {
  const [s, a, pending] = useActionState(action, {});
  return (
    <form action={a} className="au-form">
      <input type="hidden" name="token" value={token} />
      <Senha name="password" label="Senha nova" autoComplete="new-password" minLength={12} />
      <Senha name="confirm" label="Repita a senha nova" autoComplete="new-password" minLength={12} />
      <p className="au-sub" style={{ fontSize: 13 }}>
        <KeyRound size={14} className="mr-1 inline" /> Pelo menos 12 caracteres, com letras e números. Guarde num gerenciador de senhas.
      </p>
      <AuthMsg s={s} />
      <Submit pending={pending} label="Salvar senha nova" busy="Salvando..." />
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { ArrowRight, LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import { conferirCodigoAction, pedirCodigoAction, type LoginState } from "../actions";

export function ClienteLogin() {
  const [pedido, pedir, pedindo] = useActionState(pedirCodigoAction, { step: "email" } as LoginState);
  const [conferido, conferir, conferindo] = useActionState(conferirCodigoAction, { step: "codigo" } as LoginState);
  const [trocar, setTrocar] = useState(false);
  const etapa = pedido.step === "codigo" && !trocar ? "codigo" : "email";
  const email = pedido.email ?? "";

  return (
    <div className="cl-login">
      <span className="cl-empty-icon">{etapa === "email" ? <Mail size={26} /> : <ShieldCheck size={26} />}</span>
      <p className="ck-kicker">ÁREA DO CLIENTE</p>
      {etapa === "email" ? (
        <form action={(fd) => { setTrocar(false); pedir(fd); }} className="cl-login-form">
          <h1 className="ck-title">Entre com o seu e-mail</h1>
          <p className="ck-sub">Digite o e-mail usado na compra. Mandamos um código de 6 números para você entrar — sem senha.</p>
          <label className="ck-field">
            <span className="ck-label">E-mail</span>
            <input name="email" type="email" required autoComplete="email" defaultValue={email} placeholder="voce@email.com" className="ck-input" />
          </label>
          {pedido.message && !pedido.ok && <p className="ck-alert">{pedido.message}</p>}
          <button className="ck-btn" disabled={pedindo}>
            {pedindo ? <><LoaderCircle size={18} className="animate-spin" /> Enviando...</> : <>Receber código <ArrowRight size={18} /></>}
          </button>
        </form>
      ) : (
        <form action={conferir} className="cl-login-form">
          <h1 className="ck-title">Digite o código</h1>
          <p className="ck-sub">
            {pedido.message} <br />
            Enviado para <b>{email}</b>.
          </p>
          <label className="ck-field">
            <span className="ck-label">Código de 6 números</span>
            <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus
              placeholder="000000" className="ck-input cl-code" />
          </label>
          {conferido.message && <p className="ck-alert">{conferido.message}</p>}
          <button className="ck-btn" disabled={conferindo}>
            {conferindo ? <><LoaderCircle size={18} className="animate-spin" /> Conferindo...</> : <>Entrar <ArrowRight size={18} /></>}
          </button>
          <button type="button" className="ac-link" onClick={() => setTrocar(true)}>
            Não recebi / usar outro e-mail
          </button>
        </form>
      )}
    </div>
  );
}

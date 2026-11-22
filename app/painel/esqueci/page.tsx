import type { Metadata } from "next";
import Link from "next/link";
import { forgotPasswordAction } from "../actions";
import { AuthForgotForm } from "../auth-forms";
import { AuthShell, AuthTitle } from "../auth-shell";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default function EsqueciPage() {
  return (
    <AuthShell>
      <AuthTitle before="Esqueci minha" highlight="senha" />
      <p className="au-sub">Digite o e-mail que você usa para entrar no painel. Vamos mandar um link para criar uma senha nova.</p>
      <AuthForgotForm action={forgotPasswordAction} />
      <div className="au-links">
        <Link href="/painel/entrar">← Voltar para entrar</Link>
      </div>
    </AuthShell>
  );
}

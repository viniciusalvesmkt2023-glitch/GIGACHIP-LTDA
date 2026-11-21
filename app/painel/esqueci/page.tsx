import type { Metadata } from "next";
import Link from "next/link";
import { forgotPasswordAction } from "../actions";
import { ForgotPasswordForm } from "../forms";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default function EsqueciPage() {
  return (
    <div className="mx-auto max-w-sm space-y-5 px-4 py-20">
      <p className="text-2xl font-extrabold">giga<span className="text-brand">chip</span> <span className="text-base font-medium text-muted">painel</span></p>
      <h1 className="text-xl font-bold">Esqueci minha senha</h1>
      <p className="text-sm text-muted">Digite o e-mail que você usa para entrar no painel. Vamos mandar um link para criar uma senha nova.</p>
      <ForgotPasswordForm action={forgotPasswordAction} />
      <Link href="/painel/entrar" className="block text-center text-sm text-brand">← Voltar para entrar</Link>
    </div>
  );
}

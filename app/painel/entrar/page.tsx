import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { loginAction } from "../actions";
import { LoginForm } from "../forms";

export const metadata: Metadata = { title: "Entrar" };

async function Notice({ searchParams }: { searchParams: PageProps<"/painel/entrar">["searchParams"] }) {
  const sp = await searchParams;
  if (sp.senha) return <p className="rounded-xl bg-green-50 p-3 text-sm text-success">Senha nova salva! Entre com ela (o código do autenticador continua o mesmo).</p>;
  return sp.configurado ? (
    <p className="rounded-xl bg-green-50 p-3 text-sm text-success">Acesso criado! Entre e cadastre o 2FA.</p>
  ) : null;
}

export default function EntrarPage({ searchParams }: PageProps<"/painel/entrar">) {
  return (
    <div className="mx-auto max-w-sm space-y-5 px-4 py-20">
      <p className="text-2xl font-extrabold">giga<span className="text-brand">chip</span> <span className="text-base font-medium text-muted">painel</span></p>
      <Suspense fallback={null}><Notice searchParams={searchParams} /></Suspense>
      <LoginForm action={loginAction} />
      <Link href="/painel/esqueci" className="block text-center text-sm text-brand">Esqueci minha senha</Link>
    </div>
  );
}

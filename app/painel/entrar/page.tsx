import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CheckCircle2, History, LockKeyhole, ShieldCheck } from "lucide-react";
import { loginAction } from "../actions";
import { AuthLoginForm } from "../auth-forms";
import { AuthShell, AuthTitle } from "../auth-shell";

export const metadata: Metadata = { title: "Entrar" };

async function Notice({ searchParams }: { searchParams: PageProps<"/painel/entrar">["searchParams"] }) {
  const sp = await searchParams;
  const msg = sp.senha
    ? "Senha nova salva! Entre com ela (o código do aplicativo continua o mesmo)."
    : sp.configurado
      ? "Acesso criado! Entre e cadastre a verificação em duas etapas."
      : null;
  return msg ? (
    <p className="au-msg is-ok" style={{ marginTop: 18 }}>
      <CheckCircle2 size={17} /> {msg}
    </p>
  ) : null;
}

export default function EntrarPage({ searchParams }: PageProps<"/painel/entrar">) {
  return (
    <AuthShell>
      <AuthTitle before="Acesse o" highlight="painel" />
      <p className="au-sub">Entre com o e-mail e a senha da equipe. Depois, confirme com o código do aplicativo no celular.</p>
      <Suspense fallback={null}>
        <Notice searchParams={searchParams} />
      </Suspense>
      <AuthLoginForm action={loginAction} />
      <div className="au-links">
        <Link href="/painel/esqueci">Esqueci minha senha</Link>
      </div>
      <div className="au-trust">
        <span><LockKeyhole size={15} /> Conexão segura</span>
        <span><ShieldCheck size={15} /> Verificação em duas etapas</span>
        <span><History size={15} /> Acesso registrado</span>
      </div>
    </AuthShell>
  );
}

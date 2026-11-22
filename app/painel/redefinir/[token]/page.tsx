import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AlertCircle } from "lucide-react";
import { passwordResetValid } from "@/lib/server/staff-auth";
import { resetPasswordAction } from "../../actions";
import { AuthResetForm } from "../../auth-forms";
import { AuthShell, AuthTitle } from "../../auth-shell";

export const metadata: Metadata = { title: "Criar senha nova", robots: { index: false } };

async function Content({ params }: { params: PageProps<"/painel/redefinir/[token]">["params"] }) {
  const { token } = await params;
  if (!(await passwordResetValid(token))) {
    return (
      <div className="au-form">
        <p className="au-msg is-bad">
          <AlertCircle size={17} /> Este link venceu ou já foi usado.
        </p>
        <div className="au-links">
          <Link href="/painel/esqueci">Pedir um link novo</Link>
        </div>
      </div>
    );
  }
  return <AuthResetForm action={resetPasswordAction} token={token} />;
}

export default function RedefinirPage({ params }: PageProps<"/painel/redefinir/[token]">) {
  return (
    <AuthShell>
      <AuthTitle before="Criar senha" highlight="nova" />
      <p className="au-sub">Escolha uma senha forte. Ao salvar, todos os acessos abertos com a senha antiga são encerrados.</p>
      <Suspense fallback={<div className="au-form" style={{ height: 240 }} />}>
        <Content params={params} />
      </Suspense>
    </AuthShell>
  );
}

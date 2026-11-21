import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { passwordResetValid } from "@/lib/server/staff-auth";
import { resetPasswordAction } from "../../actions";
import { ResetPasswordForm } from "../../forms";

export const metadata: Metadata = { title: "Criar senha nova", robots: { index: false } };

async function Content({ params }: { params: PageProps<"/painel/redefinir/[token]">["params"] }) {
  const { token } = await params;
  if (!(await passwordResetValid(token))) {
    return (
      <div className="space-y-4">
        <p className="rounded-xl bg-red-50 p-3 text-sm text-danger">Este link venceu ou já foi usado.</p>
        <Link href="/painel/esqueci" className="block text-center text-sm text-brand">Pedir um link novo</Link>
      </div>
    );
  }
  return <ResetPasswordForm action={resetPasswordAction} token={token} />;
}

export default function RedefinirPage({ params }: PageProps<"/painel/redefinir/[token]">) {
  return (
    <div className="mx-auto max-w-sm space-y-5 px-4 py-20">
      <p className="text-2xl font-extrabold">giga<span className="text-brand">chip</span> <span className="text-base font-medium text-muted">painel</span></p>
      <h1 className="text-xl font-bold">Criar senha nova</h1>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-surface" />}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

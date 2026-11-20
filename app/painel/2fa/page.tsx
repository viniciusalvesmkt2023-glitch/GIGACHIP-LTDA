import type { Metadata } from "next";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { Suspense } from "react";
import { totpUri } from "@/lib/server/auth-crypto";
import { pendingMfaSession, startTotpEnrollment } from "@/lib/server/staff-auth";
import { totpAction } from "../actions";
import { TotpForm } from "../forms";

export const metadata: Metadata = { title: "Verificação em duas etapas" };

async function Content() {
  const session = await pendingMfaSession();
  if (!session) redirect("/painel/entrar");

  if (session.hasTotp) {
    return (
      <>
        <h1 className="text-xl font-bold">Verificação em duas etapas</h1>
        <p className="text-sm text-muted">Abra o aplicativo autenticador (Google Authenticator, Microsoft Authenticator ou similar) e digite o código da Gigachip.</p>
        <TotpForm action={totpAction} />
      </>
    );
  }

  const secret = await startTotpEnrollment(session.staff.id);
  const qr = await QRCode.toDataURL(totpUri(secret, session.staff.email), { margin: 1, width: 220 });
  return (
    <>
      <h1 className="text-xl font-bold">Ative a verificação em duas etapas</h1>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
        <li>Instale no celular o <strong>Google Authenticator</strong> ou <strong>Microsoft Authenticator</strong>.</li>
        <li>No aplicativo, toque em <strong>+</strong> e escaneie o QR Code abaixo.</li>
        <li>Digite o código de 6 números que aparecer.</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element -- QR gerado no servidor */}
      <img src={qr} alt="QR Code para o aplicativo autenticador" className="mx-auto h-52 w-52 rounded-lg border border-border bg-white p-2" />
      <details className="text-xs text-muted">
        <summary className="cursor-pointer">Não consegue escanear? Digite esta chave</summary>
        <p className="mt-2 break-all font-mono">{secret}</p>
      </details>
      <TotpForm action={totpAction} />
    </>
  );
}

export default function TwoFactorPage() {
  return (
    <div className="mx-auto max-w-sm space-y-5 px-4 py-16">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" />}>
        <Content />
      </Suspense>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { Suspense } from "react";
import { totpUri } from "@/lib/server/auth-crypto";
import { pendingMfaSession, startTotpEnrollment } from "@/lib/server/staff-auth";
import { totpAction } from "../actions";
import { AuthTotpForm } from "../auth-forms";
import { AuthShell, AuthTitle } from "../auth-shell";

export const metadata: Metadata = { title: "Verificação em duas etapas" };

async function Content() {
  const session = await pendingMfaSession();
  if (!session) redirect("/painel/entrar");

  if (session.hasTotp) {
    return (
      <>
        <AuthTitle before="Digite o" highlight="código" />
        <p className="au-sub">
          Abra o aplicativo autenticador no celular (Google Authenticator, Microsoft Authenticator ou parecido) e digite os 6
          números da <strong>Gigachip</strong>.
        </p>
        <AuthTotpForm action={totpAction} />
        <div className="au-links">
          <Link href="/painel/entrar">← Entrar com outra conta</Link>
        </div>
      </>
    );
  }

  const secret = await startTotpEnrollment(session.staff.id);
  const qr = await QRCode.toDataURL(totpUri(secret, session.staff.email), { margin: 1, width: 220 });
  return (
    <>
      <AuthTitle before="Proteja seu" highlight="acesso" />
      <p className="au-sub">É só uma vez: ligue a verificação em duas etapas. Depois, cada entrada pede um código do celular.</p>
      <ol className="au-steps">
        <li>
          <span>1</span>
          <span>Instale no celular o <b>Google Authenticator</b> ou o <b>Microsoft Authenticator</b>.</span>
        </li>
        <li>
          <span>2</span>
          <span>No aplicativo, toque em <b>+</b> e escaneie o QR Code abaixo.</span>
        </li>
        <li>
          <span>3</span>
          <span>Digite o código de 6 números que aparecer.</span>
        </li>
      </ol>
      <div className="au-qr">
        {/* eslint-disable-next-line @next/next/no-img-element -- QR gerado no servidor */}
        <img src={qr} alt="QR Code para o aplicativo autenticador" />
        <details>
          <summary>Não consegue escanear? Digite esta chave</summary>
          <p className="mt-2 break-all font-mono">{secret}</p>
        </details>
      </div>
      <AuthTotpForm action={totpAction} />
    </>
  );
}

export default function TwoFactorPage() {
  return (
    <AuthShell badge="🛡️ VERIFICAÇÃO EM DUAS ETAPAS">
      <Suspense fallback={<div className="au-form" style={{ height: 320 }} />}>
        <Content />
      </Suspense>
    </AuthShell>
  );
}

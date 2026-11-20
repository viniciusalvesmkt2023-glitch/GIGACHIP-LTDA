import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/ui";
import { currentOrderId } from "@/lib/server/customer-access";
import { getAreaView } from "@/lib/server/customer-area";
import { getIdentityReview } from "@/lib/server/identity";
import { IdentityForm } from "./identity-form";

export const metadata: Metadata = { title: "Confirmar identidade", robots: { index: false } };

async function Content() {
  const orderId = await currentOrderId();
  const view = orderId ? await getAreaView(orderId) : null;
  if (!view || !orderId) redirect("/minha-area");
  const canSend = view.status === "em_andamento" && ["not_started", "pending_documents", "retry_required"].includes(view.identityStatus);
  const review = view.identityStatus === "retry_required" ? await getIdentityReview(orderId) : null;
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link href="/minha-area" className="text-sm text-brand">← Voltar</Link>
        <h1 className="mt-2 text-2xl font-bold">Confirmar identidade</h1>
        <p className="text-sm text-muted">
          Para sua segurança e para evitar fraudes, precisamos confirmar que é você quem está contratando.
        </p>
      </div>
      {review?.rejectionReason && (
        <p className="rounded-xl border border-accent bg-amber-50 p-4 text-sm">
          <strong>Precisamos de novas fotos:</strong> {review.rejectionReason}
        </p>
      )}
      {canSend ? (
        <IdentityForm />
      ) : (
        <p className="rounded-xl bg-surface p-4 text-sm">
          {view.identityStatus === "in_review" ? "Suas fotos estão em análise. Avisaremos você." : "Esta etapa não está disponível agora."}
        </p>
      )}
      <p className="text-xs text-muted">
        As fotos são enviadas direto para a nossa área segura, guardadas de forma criptografada, vistas só pela equipe
        autorizada e apagadas após o prazo necessário. Nunca pedimos documentos por e-mail.
      </p>
    </div>
  );
}

export default function IdentidadePage() {
  return (
    <Container className="py-12">
      <Suspense fallback={<div className="mx-auto h-96 max-w-lg animate-pulse rounded-2xl bg-surface" />}>
        <Content />
      </Suspense>
    </Container>
  );
}

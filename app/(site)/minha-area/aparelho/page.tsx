import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/ui";
import { currentOrderId } from "@/lib/server/customer-access";
import { getAreaView } from "@/lib/server/customer-area";
import { DeviceForm } from "./device-form";

export const metadata: Metadata = { title: "Dados do aparelho", robots: { index: false } };

function Instructions({ simType }: { simType: "esim" | "physical" }) {
  return (
    <div className="space-y-4 rounded-2xl bg-surface p-5 text-sm">
      <p className="font-semibold">Como encontrar o IMEI{simType === "esim" ? " e o EID" : ""}</p>
      <ol className="list-decimal space-y-1 pl-5">
        <li>Abra o aplicativo <strong>Telefone</strong> do celular onde a linha vai funcionar.</li>
        <li>Digite <strong className="font-mono">*#06#</strong> (não precisa ligar).</li>
        <li>Aparecem o <strong>IMEI</strong>{simType === "esim" ? <> e o <strong>EID</strong></> : null}. Copie os números para os campos abaixo.</li>
      </ol>
      <details>
        <summary className="cursor-pointer font-medium text-brand">Não apareceu? Outros caminhos</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          <li><strong>iPhone:</strong> Ajustes → Geral → Sobre. Toque e segure no número para copiar.</li>
          <li><strong>Android:</strong> Configurações → Sobre o telefone → Status (ou Informações do IMEI).</li>
          {simType === "esim" && <li>Se não existir EID no seu aparelho, ele provavelmente não aceita eSIM. Fale com a gente pelo WhatsApp.</li>}
        </ul>
      </details>
      {simType === "physical" && (
        <p>
          <strong>Número do chip (ICCID):</strong> é o número longo impresso no cartão de plástico do chip Vivo lacrado
          que você comprou, geralmente abaixo do código de barras. Começa com <span className="font-mono">89</span>.
        </p>
      )}
    </div>
  );
}

async function Content() {
  const orderId = await currentOrderId();
  const view = orderId ? await getAreaView(orderId) : null;
  if (!view) redirect("/minha-area");
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link href="/minha-area" className="text-sm text-brand">← Voltar</Link>
        <h1 className="mt-2 text-2xl font-bold">Dados do aparelho</h1>
        <p className="text-sm text-muted">Pedido {view.code} · {view.simType === "esim" ? "eSIM" : "Chip físico"}</p>
      </div>
      <Instructions simType={view.simType} />
      <DeviceForm simType={view.simType} />
      <p className="text-xs text-muted">Esses dados são guardados de forma criptografada e usados só para ativar sua linha.</p>
    </div>
  );
}

export default function AparelhoPage() {
  return (
    <Container className="py-12">
      <Suspense fallback={<div className="mx-auto h-96 max-w-lg animate-pulse rounded-2xl bg-surface" />}>
        <Content />
      </Suspense>
    </Container>
  );
}

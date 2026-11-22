"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Consulta o status a cada 5 s enquanto aguarda o pagamento (a confirmação vem do webhook). */
export function PaymentStatusWatcher({ orderId, initialStatus }: { orderId: string; initialStatus: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    if (status !== "aguardando_pagamento") return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/pedidos/${orderId}/status`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { status: string };
        if (data.status !== status) {
          setStatus(data.status);
          router.refresh();
        }
      } catch {
        // rede instável: tenta de novo no próximo ciclo
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [orderId, status, router]);

  if (status !== "aguardando_pagamento") return null;
  return (
    <p className="flex items-center gap-2 text-sm text-muted" role="status">
      <span className="h-2 w-2 animate-pulse rounded-full bg-accent" /> Aguardando confirmação do pagamento…
    </p>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }}
      className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white hover:bg-brand-strong"
    >
      {copied ? "Código copiado!" : "Copiar código PIX"}
    </button>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

/** Consulta o status a cada 5 s enquanto aguarda o pagamento (a confirmação vem do webhook). */
export function PaymentStatusWatcher({ orderId, initialStatus, texto }: { orderId: string; initialStatus: string; texto: string }) {
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
    <p className="pg-wait" role="status">
      <span className="pg-wait-dot" /> {texto}
    </p>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={`ck-btn pg-copy-btn ${copied ? "is-copied" : ""}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          /* o código continua visível para copiar à mão */
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2500);
      }}
    >
      {copied ? <Check size={18} /> : <Copy size={18} />} {copied ? "Código copiado!" : "Copiar código Pix"}
    </button>
  );
}

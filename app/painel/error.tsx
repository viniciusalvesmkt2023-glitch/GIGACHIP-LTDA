"use client";

import { buttonStyles } from "@/components/ui";

/**
 * Erro no painel (ex.: o banco não respondeu a tempo — as conexões já foram trocadas, então
 * tentar de novo normalmente funciona). Não mostra detalhes técnicos na tela.
 */
export default function PainelError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="text-4xl" aria-hidden>⚠️</p>
      <h1 className="mt-3 text-xl font-bold">Não conseguimos carregar esta tela</h1>
      <p className="mt-2 text-sm text-muted">
        O banco de dados demorou para responder. Isso costuma ser passageiro — tente de novo.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button onClick={() => retry()} className={`${buttonStyles.primary} py-2`}>Tentar de novo</button>
        <button onClick={() => window.location.reload()} className={`${buttonStyles.secondary} py-2`}>Recarregar a página</button>
      </div>
    </div>
  );
}

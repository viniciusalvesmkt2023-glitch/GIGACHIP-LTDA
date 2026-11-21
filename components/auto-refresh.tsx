"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Atualiza a página sozinha a cada `seconds` (só os dados do servidor; o que a pessoa digitou
 * nos campos é mantido). Não atualiza com a aba em segundo plano, para não gastar consultas.
 */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}

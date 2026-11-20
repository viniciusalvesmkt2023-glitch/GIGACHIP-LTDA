"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Enquanto o cliente assina na D4Sign, atualiza a página sozinha para liberar o próximo passo. */
export function RefreshWhileWaiting({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}

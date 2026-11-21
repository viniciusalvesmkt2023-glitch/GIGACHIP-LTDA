"use client";

import { AutoRefresh } from "@/components/auto-refresh";

/** Enquanto o cliente assina na D4Sign, atualiza a página sozinha para liberar o próximo passo. */
export function RefreshWhileWaiting({ seconds = 15 }: { seconds?: number }) {
  return <AutoRefresh seconds={seconds} />;
}

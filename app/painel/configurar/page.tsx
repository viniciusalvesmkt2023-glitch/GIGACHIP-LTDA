import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { env } from "@/lib/server/env";
import { staffCount } from "@/lib/server/staff-auth";
import { setupAction } from "../actions";
import { SetupForm } from "../forms";

export const metadata: Metadata = { title: "Configurar painel" };

async function Content() {
  await connection();
  if (!env().ADMIN_SETUP_TOKEN) return <p className="text-sm text-muted">Configuração desativada.</p>;
  if ((await staffCount()) > 0) return <p className="text-sm text-muted">O painel já está configurado. Use a tela de entrar.</p>;
  return <SetupForm action={setupAction} />;
}

export default function ConfigurarPage() {
  return (
    <div className="mx-auto max-w-sm space-y-5 px-4 py-16">
      <h1 className="text-xl font-bold">Primeiro acesso ao painel</h1>
      <Suspense fallback={null}><Content /></Suspense>
    </div>
  );
}

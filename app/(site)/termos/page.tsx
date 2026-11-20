import type { Metadata } from "next";
import { Container } from "@/components/ui";

export const metadata: Metadata = { title: "Termos de uso" };

export default function Page() {
  return (
    <Container className="max-w-3xl py-16">
      <h1 className="text-3xl font-bold">Termos de uso</h1>
      <p className="mt-6 rounded-xl border border-accent bg-amber-50 p-4 text-sm">
        Documento em elaboração com assessoria jurídica. Será publicado antes do início das vendas.
      </p>
    </Container>
  );
}

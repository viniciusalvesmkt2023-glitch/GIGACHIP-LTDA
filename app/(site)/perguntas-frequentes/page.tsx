import type { Metadata } from "next";
import { Container, SectionTitle } from "@/components/ui";
import { FAQ as faq } from "@/lib/faq";

export const metadata: Metadata = {
  title: "Perguntas frequentes",
  description: "Dúvidas sobre contratação, pagamento, eSIM, chip físico, IMEI, EID e ativação da linha.",
};


export default function FaqPage() {
  return (
    <Container className="max-w-3xl py-16">
      <SectionTitle eyebrow="Ajuda" title="Perguntas frequentes" />
      <div className="mt-10 divide-y divide-border rounded-2xl border border-border">
        {faq.map((item) => (
          <details key={item.q} className="group p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
              {item.q}
              <span aria-hidden className="text-brand transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted">{item.a}</p>
          </details>
        ))}
      </div>
    </Container>
  );
}

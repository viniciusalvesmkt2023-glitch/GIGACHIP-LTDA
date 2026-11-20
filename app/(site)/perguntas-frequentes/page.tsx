import type { Metadata } from "next";
import { Container, SectionTitle } from "@/components/ui";

export const metadata: Metadata = {
  title: "Perguntas frequentes",
  description: "Dúvidas sobre contratação, pagamento, eSIM, chip físico, IMEI, EID e ativação da linha.",
};

const faq: { q: string; a: string }[] = [
  {
    q: "A Gigachip é a Vivo?",
    a: "Não. A Gigachip é uma empresa independente, parceira comercial da Vivo. As linhas funcionam na rede Vivo e são fornecidas pela Gigachip.",
  },
  {
    q: "Tem fidelidade ou multa para cancelar?",
    a: "Não. Os planos não têm fidelidade. Você pode cancelar quando quiser, sem multa.",
  },
  {
    q: "Como pago a mensalidade?",
    a: "Por PIX ou cartão de crédito. A 1ª mensalidade é paga na contratação e as próximas vencem todo mês no mesmo dia da compra.",
  },
  {
    q: "O que acontece se eu atrasar o pagamento?",
    a: "Você recebe lembretes 3 dias antes e no dia do vencimento. Se a mensalidade não for paga até o fim do dia do vencimento, a linha é bloqueada a partir do dia seguinte e desbloqueada após a confirmação do pagamento.",
  },
  {
    q: "Qual a diferença entre eSIM e chip físico?",
    a: "O eSIM é um chip digital, instalado direto no aparelho (o celular precisa ser compatível). O chip físico é o cartãozinho tradicional: você compra um chip Vivo lacrado em uma loja e nos informa o número impresso nele (ICCID).",
  },
  {
    q: "Como descubro o IMEI e o EID do meu celular?",
    a: "Abra o aplicativo Telefone e digite *#06#. Aparecem o IMEI e, em aparelhos compatíveis com eSIM, o EID. No iPhone também dá para ver em Ajustes > Geral > Sobre.",
  },
  {
    q: "Por que preciso enviar documento e selfie?",
    a: "Para confirmar que é você mesmo quem está contratando e evitar fraudes. O envio é feito pela sua área segura no site — nunca por e-mail. Os arquivos são apagados após o prazo necessário.",
  },
  {
    q: "Posso usar o número da linha no WhatsApp ou no banco?",
    a: "Não. Pelo contrato, o número fornecido não pode ser usado para cadastrar WhatsApp nem aplicativos bancários, chave PIX ou recuperação de senha.",
  },
  {
    q: "Em quanto tempo a linha é ativada?",
    a: "Depois que o pagamento, a confirmação de identidade, o contrato e os dados do aparelho estiverem completos, nossa equipe faz a ativação e você recebe a confirmação.",
  },
];

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

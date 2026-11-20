/**
 * Modelo do contrato (docs/contrato/modelo-contrato-v2.md) em forma de dados.
 * Cada contrato gerado grava a versão usada (contracts.template_version).
 *
 * Feito para ASSINATURA ELETRÔNICA (D4Sign): não tem linhas para assinar nem "local e data" —
 * a D4Sign anexa ao final o relatório de assinaturas (nome, CPF, e-mail, data, hora, IP).
 * Texto em **negrito** usa a marcação **assim**.
 */
import { formatBRL } from "@/lib/domain/money";

export const CONTRACT_TEMPLATE_VERSION = "v3-teste-2026-11";

export type ContractSettings = {
  version: string;
  /** Versão de teste: o PDF sai com aviso "não válido" em todas as páginas. */
  isTest: boolean;
  /** WhatsApp de atendimento já formatado. null = ainda não existe (o contrato usa só o e-mail). */
  whatsapp: string | null;
  supportEmail: string;
  privacyUrl: string;
  /** E-mail para assuntos de dados pessoais (LGPD). */
  dpoEmail: string;
  /** Ex.: "24 (vinte e quatro) horas". */
  unblockTime: string;
  /** Dias com a linha bloqueada até o cancelamento definitivo (D10). */
  blockedDaysBeforeCancel: number;
};

export type ContractData = {
  orderCode: string;
  customer: { fullName: string; cpf: string; birthDate: string; email: string; phone: string };
  plan: { name: string; baseGb: number; bonusGb: number; totalGb: number; monthlyPriceCents: number };
  simType: "esim" | "physical";
  billingType: "pix" | "credit_card";
  dueDay: number;
};

export type Block =
  | { type: "title"; text: string }
  | { type: "meta"; text: string }
  | { type: "heading"; text: string }
  | { type: "para"; text: string };

const NUMBER_WORDS: Record<number, string> = { 1: "um", 2: "dois", 3: "três", 4: "quatro", 5: "cinco", 7: "sete", 10: "dez", 15: "quinze", 30: "trinta" };
const days = (n: number) => `${n} (${NUMBER_WORDS[n] ?? n}) dia${n === 1 ? "" : "s"}`;

function formatCpf(digits: string) {
  const d = digits.replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : digits;
}

function formatDateBr(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function formatPhone(e164: string) {
  const d = e164.replace(/\D/g, "").replace(/^55/, "");
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : e164;
}

export function buildContract(data: ContractData, s: ContractSettings): Block[] {
  const c = data.customer;
  const contact = s.whatsapp ? `e-mail ${s.supportEmail} e WhatsApp ${s.whatsapp}` : `e-mail ${s.supportEmail}`;
  const sim = data.simType === "esim" ? "eSIM" : "chip físico lacrado adquirido pelo CLIENTE";
  const pay = data.billingType === "pix" ? "PIX" : "cartão de crédito";

  return [
    { type: "title", text: "CONTRATO DE FORNECIMENTO DE LINHA MÓVEL" },
    { type: "meta", text: `Pedido nº **${data.orderCode}** · Modelo ${s.version}` },
    {
      type: "para",
      text: `**CONTRATADA:** Gigachip Ltda., CNPJ 51.968.628/0001-16. Atendimento: ${contact}.`,
    },
    {
      type: "para",
      text: `**CLIENTE:** ${c.fullName}, CPF ${formatCpf(c.cpf)}, nascido(a) em ${formatDateBr(c.birthDate)}, e-mail ${c.email}, celular de contato ${formatPhone(c.phone)}.`,
    },

    { type: "heading", text: "1. Objeto" },
    {
      type: "para",
      text: `1.1. Fornecimento, para uso do CLIENTE, de linha móvel com acesso à rede Vivo, **registrada em nome da CONTRATADA**, no **${data.plan.name}**: franquia mensal de internet de **${data.plan.totalGb}GB** (${data.plan.baseGb}GB + ${data.plan.bonusGb}GB de bônus, renovado todo mês enquanto o plano estiver ativo) e **ligações ilimitadas**.`,
    },
    { type: "para", text: `1.2. Tipo de ativação: **${sim}**.` },
    {
      type: "para",
      text: "1.3. O número da linha e a data de ativação serão informados no **Termo de Ativação**, disponibilizado na área do cliente e por e-mail, que passa a integrar este contrato.",
    },
    {
      type: "para",
      text: "1.4. As condições da oferta da operadora (cobertura, velocidade, alcance das chamadas, uso permitido e restrições) estão descritas na página do plano e foram apresentadas antes do aceite.",
    },

    { type: "heading", text: "2. Valor, pagamento e atraso" },
    {
      type: "para",
      text: `2.1. Mensalidade de **${formatBRL(data.plan.monthlyPriceCents)}**, cobrada pela CONTRATADA por meio da plataforma Asaas, por **${pay}**. A primeira mensalidade é paga na contratação e cobre os primeiros 30 dias; as seguintes vencem todo dia **${data.dueDay}** (mesmo dia da contratação). Nos meses que não tiverem esse dia, o vencimento será no último dia do mês.`,
    },
    { type: "para", text: "2.2. A CONTRATADA enviará lembretes de pagamento 3 (três) dias antes e no dia do vencimento." },
    {
      type: "para",
      text: `2.3. **Não havendo pagamento até o fim do dia do vencimento, o uso da linha será bloqueado a partir do dia seguinte**, até a quitação. Confirmado o pagamento, a linha será desbloqueada em até ${s.unblockTime}.`,
    },
    {
      type: "para",
      text: `2.4. **Permanecendo a linha bloqueada por ${days(s.blockedDaysBeforeCancel)} sem pagamento, o contrato será cancelado** e a autorização de uso da linha encerrada (cláusula 5), sem prejuízo da cobrança dos valores devidos. Por a linha ser de titularidade da CONTRATADA, o número não poderá ser recuperado após o cancelamento.`,
    },
    {
      type: "para",
      text: "2.5. A mensalidade poderá ser reajustada (a) a cada 12 (doze) meses, pela variação do IPCA/IBGE; ou (b) a qualquer tempo, quando a operadora aumentar o custo do plano, limitado ao valor desse aumento. O CLIENTE será avisado com no mínimo 30 (trinta) dias de antecedência e, se não concordar, poderá cancelar sem multa.",
    },

    { type: "heading", text: "3. Sem fidelidade" },
    {
      type: "para",
      text: "3.1. Não há prazo mínimo de permanência nem multa por cancelamento. O CLIENTE pode cancelar a qualquer momento pelo canal de atendimento; o cancelamento vale ao fim do período já pago.",
    },

    { type: "heading", text: "4. Uso da linha" },
    {
      type: "para",
      text: "4.1. É proibido usar o número fornecido para cadastrar ou ativar conta de **WhatsApp**, ou vinculá-lo a **aplicativos bancários**, contas financeiras, chave PIX, recuperação de senha ou autenticação desses serviços. A restrição não impede o uso desses aplicativos com outro número do CLIENTE.",
    },
    {
      type: "para",
      text: "4.2. É proibido o uso da linha para fins ilícitos, envio massivo de mensagens, revenda ou cessão a terceiros. O descumprimento permite a suspensão imediata e o cancelamento.",
    },

    { type: "heading", text: "5. Titularidade, devolução e portabilidade" },
    {
      type: "para",
      text: "5.1. A linha permanece registrada em nome da CONTRATADA. O cancelamento encerra a autorização de uso e a gestão da linha permanece com a CONTRATADA.",
    },
    {
      type: "para",
      text: "5.2. O CLIENTE não poderá solicitar transferência de titularidade ou portabilidade da linha sem autorização. Esta condição não alcança números de titularidade do próprio CLIENTE nem afasta direitos assegurados pela legislação e pela Anatel.",
    },
    { type: "para", text: "5.3. Antes da devolução, o CLIENTE deve desvincular contas pessoais do número." },

    { type: "heading", text: "6. Validação de identidade e veracidade dos dados" },
    {
      type: "para",
      text: "6.1. O CLIENTE declara que os dados informados são verdadeiros e autoriza a validação de sua identidade por meio de documento oficial com foto e selfie.",
    },
    {
      type: "para",
      text: "6.2. Se a validação não for concluída ou for reprovada, a CONTRATADA poderá recusar a ativação, com **reembolso integral** dos valores pagos.",
    },

    { type: "heading", text: "7. Dados pessoais (LGPD)" },
    {
      type: "para",
      text: `7.1. A CONTRATADA trata os dados do CLIENTE (cadastro, documento, selfie, dados do aparelho e do chip, pagamentos) para executar este contrato, prevenir fraudes e cumprir obrigações legais e regulatórias, conforme a **Política de Privacidade** (${s.privacyUrl}).`,
    },
    { type: "para", text: "7.2. Imagens de documento e selfie são mantidas apenas pelo prazo necessário e depois excluídas." },
    { type: "para", text: `7.3. Pedidos sobre dados pessoais (acesso, correção, exclusão e demais direitos da LGPD): ${s.dpoEmail}.` },

    { type: "heading", text: "8. Atendimento, arrependimento e cancelamento" },
    { type: "para", text: `8.1. Suporte e cancelamento: ${contact}, com registro e protocolo.` },
    {
      type: "para",
      text: "8.2. Por ser contratação fora do estabelecimento, o CLIENTE pode desistir em até **7 (sete) dias** contados da contratação ou da ativação, sem multa e com devolução dos valores pagos (art. 49 do Código de Defesa do Consumidor).",
    },

    { type: "heading", text: "9. Assinatura eletrônica e disposições finais" },
    {
      type: "para",
      text: "9.1. Este contrato é assinado **eletronicamente** pelo CLIENTE na plataforma D4Sign, nos termos da MP 2.200-2/2001 (art. 10, §2º) e da Lei 14.063/2020. Os dados de identificação de quem assinou, a data, a hora e o endereço IP constam do **relatório de assinaturas** que a plataforma anexa ao final deste documento, dispensando assinatura à mão.",
    },
    { type: "para", text: "9.2. Fica eleito o foro do domicílio do CLIENTE." },
  ];
}

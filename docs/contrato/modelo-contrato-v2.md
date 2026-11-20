# Modelo de contrato v2 — PROPOSTA PARA REVISÃO JURÍDICA

> Rascunho baseado no contrato atual, adaptado para a contratação online. **Não usar com clientes
> antes da revisão de um advogado.** Campos `{{...}}` são preenchidos pelo sistema.
> Trechos marcados com ⚠️ dependem de decisão dos sócios.

---

**CONTRATO DE FORNECIMENTO DE LINHA MÓVEL**
Versão do modelo: {{versao_modelo}} · Pedido nº **{{codigo_pedido}}**

**CONTRATADA:** Gigachip Ltda., CNPJ 51.968.628/0001-16. Atendimento: WhatsApp {{whatsapp_atendimento}}.

**CLIENTE:** {{nome_completo}}, CPF {{cpf}}, nascido(a) em {{data_nascimento}}, e-mail {{email}},
celular de contato {{celular_contato}}.

### 1. Objeto
1.1. Fornecimento, para uso do CLIENTE, de linha móvel com acesso à rede Vivo, **registrada em nome
da CONTRATADA**, no plano **{{plano_nome}}** — franquia mensal de internet de **{{franquia_total}}**
({{franquia_detalhe}}, com o bônus renovado todo mês enquanto o plano estiver ativo) e **ligações
ilimitadas**.
1.2. Tipo de ativação: **{{tipo_ativacao}}** (eSIM, ou chip físico lacrado adquirido pelo CLIENTE).
1.3. O número da linha e a data de ativação serão informados no **Termo de Ativação**, disponibilizado
na área do cliente e por e-mail, que passa a integrar este contrato.
1.4. As condições da oferta da operadora (cobertura, velocidade, alcance das chamadas, uso permitido
e restrições) estão descritas na página do plano e foram apresentadas antes do aceite.

### 2. Valor, pagamento e atraso
2.1. Mensalidade de **{{valor_mensal}}**, cobrada pela CONTRATADA por meio da plataforma Asaas,
por **{{forma_pagamento}}** (PIX ou cartão de crédito). A primeira mensalidade é paga na contratação
e cobre os primeiros 30 dias; as seguintes vencem todo dia **{{dia_vencimento}}** (mesmo dia da
contratação). Nos meses que não tiverem esse dia, o vencimento será no último dia do mês.
2.2. A CONTRATADA enviará lembretes de pagamento 3 (três) dias antes e no dia do vencimento.
2.3. **Não havendo pagamento até o fim do dia do vencimento, o contrato será cancelado e a linha
desativada a partir do dia seguinte**, encerrando a autorização de uso prevista na cláusula 5. O
CLIENTE declara estar ciente de que, por a linha ser de titularidade da CONTRATADA, o número não
poderá ser recuperado após o cancelamento.
2.4. ⚠️ Reajuste: {{regra_reajuste}}, com aviso de no mínimo 30 dias.

### 3. Sem fidelidade
3.1. Não há prazo mínimo de permanência nem multa por cancelamento. O CLIENTE pode cancelar a
qualquer momento pelo canal de atendimento; o cancelamento vale ao fim do período já pago.

### 4. Uso da linha
4.1. É proibido usar o número fornecido para cadastrar ou ativar conta de **WhatsApp**, ou vinculá-lo
a **aplicativos bancários**, contas financeiras, chave PIX, recuperação de senha ou autenticação
desses serviços. A restrição não impede o uso desses aplicativos com outro número do CLIENTE.
4.2. É proibido o uso da linha para fins ilícitos, envio massivo de mensagens, revenda ou cessão a
terceiros. O descumprimento permite a suspensão imediata e o cancelamento.

### 5. Titularidade, devolução e portabilidade
5.1. A linha permanece registrada em nome da CONTRATADA. O cancelamento encerra a autorização de uso
e a gestão da linha permanece com a CONTRATADA.
5.2. O CLIENTE não poderá solicitar transferência de titularidade ou portabilidade da linha sem
autorização. Esta condição não alcança números de titularidade do próprio CLIENTE nem afasta
direitos assegurados pela legislação e pela Anatel.
5.3. Antes da devolução, o CLIENTE deve desvincular contas pessoais do número.

### 6. Validação de identidade e veracidade dos dados
6.1. O CLIENTE declara que os dados informados são verdadeiros e autoriza a validação de sua
identidade por meio de documento oficial com foto e selfie.
6.2. Se a validação não for concluída ou for reprovada, a CONTRATADA poderá recusar a ativação,
com **reembolso integral** dos valores pagos.

### 7. Dados pessoais (LGPD)
7.1. A CONTRATADA trata os dados do CLIENTE (cadastro, documento, selfie, dados do aparelho e do
chip, pagamentos) para executar este contrato, prevenir fraudes e cumprir obrigações legais e
regulatórias, conforme a **Política de Privacidade** ({{url_politica_privacidade}}).
7.2. Imagens de documento e selfie são mantidas apenas pelo prazo necessário e depois excluídas.
7.3. Pedidos sobre dados pessoais: {{email_encarregado}}.

### 8. Atendimento, arrependimento e cancelamento
8.1. Suporte e cancelamento: WhatsApp {{whatsapp_atendimento}}, com registro e protocolo.
8.2. Por ser contratação fora do estabelecimento, o CLIENTE pode desistir em até **7 dias** contados
da contratação ou da ativação, sem multa e com devolução dos valores pagos (art. 49 do CDC).

### 9. Disposições finais
9.1. Este contrato é aceito por **assinatura eletrônica**, válida nos termos da MP 2.200-2/2001
(art. 10, §2º) e da Lei 14.063/2020.
9.2. Fica eleito o foro do domicílio do CLIENTE.

Aceite eletrônico em {{data_aceite}} — registro de assinatura anexo (D4Sign).

---

## Campos do sistema

| Campo | Origem |
|-------|--------|
| `codigo_pedido` | `orders.code` |
| `nome_completo`, `cpf`, `data_nascimento`, `email`, `celular_contato` | `customers` (dados validados) |
| `plano_nome`, `franquia_total`, `franquia_detalhe`, `valor_mensal` | `orders.plan_snapshot` |
| `tipo_ativacao` | `orders.sim_type` |
| `dia_vencimento` | `subscriptions.due_day` |
| `forma_pagamento` | `subscriptions.billing_type` |
| `versao_modelo` | versão deste modelo, gravada em `contracts.template_version` |

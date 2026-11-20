# Análise do contrato atual ("Contrato Simplificado — Plano Vivo Ilimitado")

> Isto é uma análise técnica e de processo, **não é parecer jurídico**. A versão final precisa ser
> revisada por advogado.

## O que o contrato revela sobre o negócio

1. **A linha fica no CNPJ da Gigachip** e é fornecida ao cliente para uso (cláusula 5).
2. **A Gigachip cobra a mensalidade todo mês** (cláusula 1) → o sistema precisa de **cobrança
   recorrente** no Asaas, controle de inadimplência e suspensão (decisão D7).
3. ~~Fidelidade de 90 dias~~ — **decidido: linhas sem fidelidade (D10)**. As cláusulas 2 e 3 saem.
4. **Proibido usar o número em WhatsApp e apps bancários** (cláusula 4) — regra antifraude.

## Pontos que precisam mudar para o fluxo online

| # | Problema | Sugestão |
|---|----------|----------|
| 1 | Texto fixo "dados e voz ilimitados, R$ 149,99" — não serve para os 3 planos | Campos variáveis: nome do plano, franquia, valor |
| 2 | Campos "Linha fornecida" e "Ativação" — o contrato é assinado **antes** da ativação, então esses dados ainda não existem | Trocar pelo **número do pedido**; o número da linha e a data de ativação vão num **Termo de Ativação** enviado ao cliente (área do cliente + e-mail), que integra o contrato |
| 3 | "Benefício concedido" em branco | Definir qual é o benefício (ex.: bônus de 100GB?). Se não houver benefício valorado, a cláusula de fidelidade não pode ser cobrada |
| 4 | Falta forma de pagamento, atraso e suspensão | Incluir: cobrança mensal via Asaas, vencimento, multa de atraso de 2% + juros de 1% ao mês (limites usuais do CDC), suspensão após X dias de atraso com aviso prévio, cancelamento após Y dias |
| 5 | Falta reajuste | Incluir regra de reajuste (ex.: anual por índice, ou repasse de reajuste da operadora com aviso de 30 dias) |
| 6 | Falta cláusula de dados pessoais (LGPD) | Quais dados coletamos (inclusive documento e selfie), para quê, por quanto tempo, direitos do titular, contato do encarregado, referência à Política de Privacidade |
| 7 | Falta cláusula de validação de identidade | Cliente declara que os dados são verdadeiros; a Gigachip pode recusar a contratação e **reembolsar integralmente** se a validação falhar |
| 8 | Falta validade da assinatura eletrônica | Declarar aceite por assinatura eletrônica (MP 2.200-2/2001 e Lei 14.063/2020) |
| 9 | Falta foro | Foro do domicílio do consumidor (padrão do CDC) |
| 10 | Telefone "(88) 99999-1556" parece provisório | Confirmar o número oficial de atendimento |
| 11 | O rodapé diz "Minuta: validar oferta, titularidade e benefício antes de usar" e a cláusula 1 diz que a contratação "pressupõe autorização da operadora para a modalidade de fornecimento" | Vale ter a confirmação do gestor Vivo **por escrito (e-mail)** de que essa modalidade é autorizada — protege a empresa se um dia houver questionamento |

## Campos que o sistema vai preencher

Ver o modelo proposto em [`modelo-contrato-v2.md`](modelo-contrato-v2.md). Todos os campos
`{{assim}}` são preenchidos automaticamente a partir do pedido.

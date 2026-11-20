# 00 — Perguntas em aberto (bloqueantes)

Estas respostas mudam a arquitetura, o custo ou o que é legalmente permitido. Nenhuma delas é
resolvida com código. Marque cada uma conforme for respondida.

Legenda: 🔴 bloqueia o MVP · 🟡 bloqueia uma parte · 🟢 pode esperar

## A. Parceria Vivo (perguntar ao gerente/canal da parceria e ler o contrato)

- [ ] 🔴 **Venda online é permitida?** O contrato de parceria autoriza vender por site próprio, ou só presencial/por indicação?
- [ ] 🔴 **Uso da marca.** Podemos usar o nome "Vivo", logotipo, nomes comerciais dos planos e imagens? Existe manual de marca para parceiros? Que frase devemos usar ("revendedor autorizado", "parceiro credenciado"…)?
- [ ] 🔴 **Preço.** Quem define o preço final — Vivo ou nós? Podemos cobrar taxa própria (adesão, serviço, chip)?
- [ ] 🔴 **Quem cobra a mensalidade?** Depois de ativada, a fatura mensal vem da Vivo para o cliente, ou nós cobramos o cliente? (Isso decide se precisamos de cobrança recorrente no Asaas.)
- [ ] 🔴 **O que exatamente cobramos hoje pelo Asaas?** Chip? Primeira mensalidade? Taxa de ativação? Plano inteiro?
- [ ] 🔴 **Documentos exigidos pela Vivo para ativar.** Lista oficial: quais dados, quais documentos, se precisa selfie, se precisa contrato próprio nosso ou se a Vivo tem termo próprio.
- [ ] 🔴 **Biometria Anatel (Norma GT-SEG.2026.11).** A Anatel passou a exigir biometria facial com prova de vida para ativar linhas (pré-pago até set/2027; pós-pago e portabilidade até dez/2027). Como a Vivo vai aplicar isso no canal de parceiros? O portal da Vivo fará a biometria (ex.: link enviado ao cliente) ou o parceiro precisa coletar? **Se a Vivo fizer, não precisamos pagar um provedor de biometria só para repetir o processo.**
- [ ] 🔴 **Retenção e compartilhamento de dados.** O contrato de parceria diz por quanto tempo devemos guardar documentos/contratos e se podemos usar fornecedores externos (nuvem, provedor de identidade)?
- [ ] 🟡 **eSIM.** Como o eSIM é entregue? A Vivo gera um QR Code que o pai repassa? Por qual canal? Tem validade?
- [ ] 🟡 **Chip físico.** Quem envia o chip? Retirada presencial, Correios, motoboy? Quem paga o frete? O ICCID do chip precisa ser informado na ativação?
- [ ] 🟡 **Portabilidade.** Vamos vender portabilidade (cliente traz número de outra operadora)? Quais dados a Vivo pede?
- [ ] 🟡 **Limite de linhas por CPF** e regras antifraude que a Vivo aplica.
- [ ] 🟢 **Comissão.** Como a Vivo remunera o parceiro (para o painel financeiro futuro).

## B. D4Sign

- [ ] 🔴 **O plano atual dá acesso à API?** Gerar `tokenAPI` e `cryptKey` no painel (se o menu não aparecer, o plano provavelmente não inclui API).
- [ ] 🔴 **Limite de requisições.** A documentação cita limite padrão de **10 requisições por hora**. Cada contrato usa ~4 chamadas (criar documento, cadastrar signatário, enviar, registrar webhook), ou seja ~2 contratos/hora. Pedir aumento ao suporte e confirmar por escrito.
- [ ] 🟡 **Modelo de contrato (template) via API.** Confirmar se o plano permite gerar documento a partir de modelo com campos variáveis pela API, e em qual formato o modelo precisa estar. Se não permitir, geramos o PDF nós mesmos e enviamos por upload (ver doc 02).
- [ ] 🟡 **Autenticação do signatário.** Quais opções o plano inclui (token por SMS/WhatsApp, foto de documento, selfie)? Têm custo extra por assinatura?
- [ ] 🟡 Acesso ao **sandbox** (`sandbox.d4sign.com.br`) para testes.

## C. Asaas

- [ ] 🔴 Conta Asaas é **PJ (CNPJ da GIGACHIP)** ou PF do pai? A cobrança deve sair no CNPJ da sociedade.
- [ ] 🔴 Criar conta no **sandbox** e gerar chave de API de teste.
- [ ] 🟡 **Cartão de crédito** está habilitado na conta? Quais taxas e prazos?
- [ ] 🟡 Política de **estorno** e como tratar chargeback em linha já ativada.
- [ ] 🟢 Emissão de **nota fiscal** (NFS-e) — o Asaas tem esse recurso; confirmar se faz sentido para o modelo de receita (depende da resposta "o que cobramos").

## D. Jurídico / contábil (advogado e contador)

- [ ] 🔴 Revisar o **modelo de contrato** atual para venda online (direito de arrependimento de 7 dias — CDC art. 49; informações obrigatórias de e-commerce — Decreto 7.962/2013).
- [ ] 🔴 **Política de Privacidade**, **Termos de Uso** e definição do **encarregado (DPO)** — LGPD.
- [ ] 🔴 **Base legal** para tratar biometria e documentos (dado pessoal sensível — LGPD art. 11).
- [ ] 🟡 **Prazos de retenção** de cada tipo de dado (contrato, documentos, comprovante de pagamento, IMEI/EID).
- [ ] 🟡 Política de **reembolso** quando a identidade for recusada ou a Vivo negar a ativação.

## E. Operação

- [ ] 🔴 **Domínio** (sem a palavra "vivo") e e-mail profissional do domínio.
- [ ] 🔴 Quem são os **usuários do painel** no início (pai, você, mais alguém?) e o que cada um pode ver.
- [ ] 🟡 **Número de WhatsApp** que será usado no site (de preferência um número comercial dedicado, não o pessoal).
- [ ] 🟡 Lista inicial de **planos**, preços e benefícios.
- [ ] 🟢 Volume esperado de vendas por mês (dimensiona custos de identidade, e-mail, WhatsApp).

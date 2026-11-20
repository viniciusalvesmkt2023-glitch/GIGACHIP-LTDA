# 07 — Registro de decisões

Decisões tomadas pelos sócios. Quando uma decisão contradiz algo nos documentos 01–06, **vale
o que está aqui**.

## D1 — Pagamento logo após o cadastro básico (20/11/2026)

**Decisão:** o cliente escolhe o plano, preenche o formulário inicial e **paga em seguida**. Validação
de identidade, contrato e dados do aparelho vêm depois do pagamento.

**Motivo:** é o modelo que já funciona na operação atual.

**Consequência:** o reembolso de quem for recusado na validação vira uma exceção tratada no painel
(status `pendencia` → `cancelado_reembolso`). A política de reembolso deve estar escrita nos termos.

## D2 — Formulário inicial (antes do pagamento)

Campos: **nome completo, CPF, data de nascimento, e-mail, WhatsApp, tipo de ativação**.

Tipos de ativação:
- **eSIM**
- **Chip físico lacrado comprado pelo cliente numa loja** (não enviamos chip)

## D3 — Validação de identidade é obrigatória (política própria)

**Decisão:** sempre validar a identidade, mesmo que a Vivo não exija hoje.

**Motivo:** as linhas ficam vinculadas ao **CNPJ da empresa**; vender para a pessoa errada é risco
nosso (fraude, uso indevido da linha).

**Como (MVP):** documento (RG/CNH) + selfie, enviados por upload seguro na área do cliente
(bucket privado), aprovados pela equipe no painel, com exclusão automática dos arquivos após o prazo
definido. A etapa é uma interface trocável: depois pode virar um provedor automático, ou a
autenticação por selfie/documento da própria plataforma de assinatura (ver D5).

## D4 — Dados do aparelho/chip por tipo de ativação

| Tipo | Dados pedidos | Validação automática |
|------|---------------|---------------------|
| eSIM | IMEI + **EID** | IMEI: 15 dígitos + Luhn · EID: 32 dígitos + dígitos verificadores (mod 97) |
| Chip físico lacrado | IMEI + **ICCID** (número impresso no cartão do chip) | ICCID: 19–20 dígitos, começa com `89`, último dígito Luhn |

*(Validar as regras com chips e aparelhos reais antes de bloquear o envio; até lá, avisar sem bloquear.)*

## D5 — Plataforma de assinatura: provedor trocável, PDF gerado pelo sistema

**Decisão:** o sistema preenche o modelo de contrato e gera o PDF (exatamente o que é feito à mão
hoje), e envia pela API do provedor de assinatura. Assim o provedor pode ser trocado sem mexer no
resto.

**Provedor:** a escolher após teste em sandbox. Candidatos, por custo para o nosso volume:

| Provedor | Modelo de preço (fontes públicas, confirmar) | Observação |
|----------|------------------------------------------|-----------|
| **Autentique** | Por uso: ~R$ 0,06 por documento + ~R$ 0,013 por envio por e-mail; plano gratuito com limite mensal pequeno; plano Profissional R$ 99/mês | Provavelmente o mais barato para o nosso caso; tem sandbox |
| **ZapSign** | Planos de API em dólar: ~US$ 39/mês (80 docs), ~US$ 94/mês (200 docs) | Oferece autenticação por selfie + documento (confirmar no plano de API) |
| **D4Sign** (atual) | Planos mensais; API depende do plano; limite padrão de 10 req/h | Já em uso; exige pedir aumento de limite |
| **Clicksign** | Sob consulta | Robusta, geralmente mais cara |

Pontos a confirmar em cada uma antes de decidir: webhooks de assinatura, download do PDF assinado
com trilha de auditoria, limite de requisições, preço real no volume esperado, e se a autenticação
por selfie/documento pode substituir a nossa etapa de identidade (D3).

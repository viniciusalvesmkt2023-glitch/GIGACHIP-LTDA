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

## D6 — Usar a D4Sign que já é paga (20/11/2026)

**Decisão:** usar a conta D4Sign atual — **Plano Advanced, R$ 99/mês: 50 envios/mês, 50 envios por
WhatsApp, 400 créditos D4Sign AI**. Os outros provedores ficam como plano B (a arquitetura de D5
permite trocar).

**Por que faz sentido:** já está pago e o modelo de contrato já existe. No volume previsto (até 50
contratos/mês), o limite padrão da API (10 requisições/hora, ~4 por contrato) é suficiente, desde
que os envios passem pela fila com controle de taxa.

**A confirmar:**
- [x] O plano Advanced libera a API — confirmado: menu **Dev (API)** ativo, chaves geradas pelo sócio (guardadas fora do repositório). A conta também tem menu **Webhooks**.
- [ ] Sandbox: não encontrado no painel. Plano: testar em produção com poucos envios reais (volume atual ~20/mês, sobra cota), usando o e-mail dos próprios sócios como signatário
- [ ] Se dá para enviar o link de assinatura por WhatsApp pela API, e se isso consome os 50 envios de WhatsApp
- [ ] O que acontece acima de 50 envios/mês (preço do excedente ou bloqueio)

**Alerta no painel:** mostrar quantos envios do mês já foram usados, para não estourar o limite sem perceber.

## D7 — A Gigachip cobra a mensalidade todo mês (20/11/2026)

**Origem:** contrato atual (cláusula 1) — a linha fica no CNPJ da Gigachip e o cliente paga a
mensalidade à Gigachip.

**Consequências no sistema:**
- **Assinatura no Asaas** criada na contratação; a 1ª mensalidade é paga no checkout (PIX) e as
  seguintes são geradas todo mês pelo Asaas.
- Nova entidade **`lines`** (linha fornecida): número, ativação e ciclo de vida
  `ativa → suspensa → cancelada`. Substitui a tabela `activations` do doc 04.
- Painel ganha a fila de **inadimplentes** e a tarefa manual de **suspender/reativar** a linha na Vivo.
- A cobrança recorrente entra no MVP.

**Decidido em D9–D12.** Ainda a decidir: regra de reajuste.

## D8 — Planos iniciais (20/11/2026)

| Plano | Franquia | Total | Mensalidade |
|-------|----------|-------|-------------|
| Plano 200GB | 100GB + 100GB bônus | 200GB | R$ 124,99 |
| Plano 300GB | 200GB + 100GB bônus | 300GB | R$ 149,99 |
| Plano 400GB | 300GB + 100GB bônus | 400GB | R$ 179,99 |

Cadastrados em `supabase/seed.sql`. Ver D11 para ligações e bônus. A confirmar: nomes comerciais definitivos.

## D9 — Vencimento no mesmo dia da compra (20/11/2026)

Compra em 20/11 → a 1ª mensalidade é paga na hora e cobre 30 dias; as próximas vencem todo dia 20.
Compras nos dias 29–31: em meses sem esse dia, vence no último dia do mês e volta ao dia original
no mês seguinte. Implementado em `lib/domain/billing.ts`.

## D10 — Sem fidelidade; atraso BLOQUEIA a linha até pagar (20/11/2026, revisado)

- Linhas **sem fidelidade e sem multa** de cancelamento.
- Lembretes automáticos 3 dias antes e no dia do vencimento.
- Mensalidade não paga até o fim do dia do vencimento → **no dia seguinte a linha é bloqueada**
  (não cancelada) até o cliente pagar. Prazo configurável (`suspendAfterDays`, padrão 1).
- Bloquear e desbloquear são feitos à mão na Vivo, então o painel tem duas filas:

  | Situação | Status da linha | Fila no painel |
  |----------|-----------------|----------------|
  | Venceu e não pagou | `suspensao_pendente` | **"Bloquear na Vivo"** |
  | Equipe bloqueou | `suspensa` | — |
  | Cliente pagou a mensalidade atrasada | `reativacao_pendente` | **"Desbloquear na Vivo"** + aviso ao cliente |
  | Equipe desbloqueou | `ativa` | — |

- Se o cliente pagar **antes** de a equipe bloquear, a linha volta a `ativa` sozinha e sai da fila.
- **Cancelamento definitivo** por atraso longo: só se configurado (`cancelAfterDays`). ⚠️ A definir
  com os sócios quantos dias bloqueada até cancelar de vez (ou se nunca cancela automaticamente).
- Implementado em `lib/domain/billing.ts` e na migração `20261120000002_bloqueio_por_atraso.sql`.

## D11 — Planos: ligações ilimitadas, bônus permanente (20/11/2026)

Todos os planos têm ligações ilimitadas. O bônus de 100GB é parte do plano e renova todo mês
enquanto o plano estiver ativo.

## D12 — PIX e cartão de crédito pelo Asaas (20/11/2026)

**Decisão:** manter tudo no Asaas, com **PIX** e **cartão de crédito**, sem Stripe.

**Motivo:** o Asaas já é usado, faz assinatura mensal com PIX e com cartão, e ter um só provedor de
pagamento simplifica conciliação, webhooks, painel e financeiro. O Stripe só faria sentido se o
Asaas recusar cartão para a conta.

**Como:** o cliente escolhe PIX ou cartão no checkout. Os dados do cartão são digitados na página de
pagamento do Asaas (nunca passam pelo nosso servidor).

**A confirmar no sandbox / com o Asaas:**
- [ ] Cartão de crédito habilitado na conta (pode exigir análise do Asaas) e taxas
- [ ] Em assinatura com cartão, as mensalidades seguintes são cobradas sozinhas no cartão salvo
- [ ] Assinatura com PIX: o Asaas gera a cobrança PIX de cada mês e avisa o cliente
- [ ] Se a conta tem **Pix Automático** (débito recorrente via PIX), que evitaria o cliente ter de pagar manualmente todo mês
- [ ] Como o Asaas trata vencimento em dia 29–31 nas assinaturas (o sistema já calcula pela regra D9)

## D13 — Acesso ao banco direto pelo servidor; visual provisório (20/11/2026)

- O site acessa o Postgres do Supabase **direto do servidor** (driver `postgres`, URL do
  *Transaction pooler*), nunca do navegador. O Supabase continua sendo usado para banco, Auth
  (Fase 3) e Storage. Vantagem: as mesmas consultas rodam no Postgres local dos testes.
- Visual **provisório e neutro** (azul petróleo), definido só em variáveis de `app/globals.css`,
  até a Gigachip ter logo e cores. O roxo da Vivo foi evitado de propósito.

## D14 — Fluxo de pagamento implementado (Fase 2)

- Na contratação, o sistema cria no Asaas o cliente e uma **assinatura mensal** com a 1ª
  mensalidade vencendo no dia (PIX ou cartão). Se algo falhar depois de criar a assinatura, ela é
  apagada para não ficar cobrando.
- O pedido só vira "pago" pelo webhook **depois de consultar a cobrança na API do Asaas**
  (testado: webhook dizendo "pago" com a API ainda "pendente" não confirma nada).
- CPF já cadastrado com e-mail ou nascimento diferentes **não sobrescreve** o cadastro: o cliente é
  orientado a falar no WhatsApp (evita que alguém troque o e-mail de outra pessoa).
- Pedido não pago expira em 48 h (a rotina que expira e cancela a assinatura no Asaas fica para a
  Fase 3, junto com as demais rotinas agendadas).

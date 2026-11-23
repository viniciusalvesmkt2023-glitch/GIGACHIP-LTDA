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
- **Cancelamento definitivo:** depois de **5 dias bloqueada** sem pagar (vencimento dia 20 →
  bloqueio dia 21 → cancelamento dia 26). Decidido em 20/11/2026 (D19).
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

## D15 — Acesso do cliente sem senha (Fase 3)

- A "Minha área" não usa senha. Na compra, o navegador recebe um **cookie seguro** (httpOnly) com
  um token aleatório; de outro aparelho, o cliente entra pelo **link enviado por e-mail**
  (`/acesso/<token>`, válido por 30 dias). Só o hash do token é guardado
  (`order_access_tokens`, migração 0003).
- Dados do aparelho: IMEI sempre; EID para eSIM; ICCID para chip lacrado. IMEI errado bloqueia;
  EID/ICCID com dígito verificador estranho pede confirmação do cliente e fica registrado
  (`device_info.checksum_warnings`) para a equipe conferir.
- Visual: o layout atual é provisório. Depois que tudo funcionar, cada página será lapidada com a
  identidade visual da Gigachip (logo, cores e referências que os sócios escolherem).

## D16 — Login próprio da equipe com 2FA obrigatório (Fase 3)

- O painel (`/painel`) usa **login próprio**: e-mail + senha (scrypt) + **2FA obrigatório** por
  aplicativo autenticador (TOTP, RFC 6238 — testado com os vetores oficiais). Não usa o Supabase
  Auth: menos peças, e tudo roda e é testado no Postgres local.
- Sessões de 12 h em cookie httpOnly/SameSite=Strict; só o hash do token fica no banco.
- Bloqueio de 15 min após 5 senhas erradas para o mesmo e-mail.
- Primeiro acesso: `/painel/configurar`, só com o código `ADMIN_SETUP_TOKEN` e só enquanto não
  existir ninguém na equipe. Depois, o dono adiciona pessoas em `/painel/equipe`.
- Funções: dono, administrador, ativador (veem documentos e dados completos), atendente e
  financeiro (veem só dados mascarados). Ver documento e revelar CPF/IMEI/EID/ICCID ficam na auditoria.

## D17 — Fotos de identidade cifradas no próprio banco (Fase 3)

- Documento (frente/verso) e selfie são reduzidos no celular do cliente, conferidos pelo tipo
  real do arquivo, **cifrados (AES-256-GCM)** e guardados em `identity_file_blobs`, separados dos
  metadados. Não usamos bucket de arquivos: uma integração a menos e nada fica em link público.
- Até 3 tentativas; a equipe aprova ou pede novas fotos com um motivo que o cliente vê. Na 3ª recusa
  o pedido vai para **pendência**.
- Guarda provisória de **90 dias** (`delete_after`), a confirmar com o advogado; a rotina que apaga
  entra junto com as demais rotinas agendadas.

## D18 — Identidade visual: logo e cores da Gigachip (20/11/2026)

- Logo em `public/brand/` (PNG 512 e 192 px) e embutida no contrato (`lib/contract/logo.ts`).
- Cores (amostradas da logo): **ciano `#01BAFE` → verde-água `#34FBA6` → verde-limão `#D8FD0D`**,
  sobre fundo quase preto `#000105`.
- Já aplicadas no **contrato em PDF**: faixa escura com a logo no topo, linha em degradê da marca,
  marcadores nos títulos e rodapé com CNPJ e numeração. O site recebe a identidade na fase de
  lapidação visual.

## D19 — Condições finais do contrato (20/11/2026)

- **Desbloqueio:** até 24 horas depois da confirmação do pagamento.
- **Cancelamento por atraso:** após 5 dias com a linha bloqueada (`DEFAULT_CANCEL_AFTER_DAYS = 6`
  contados do vencimento).
- **Reajuste:** como o preço depende do custo cobrado pela operadora, o contrato prevê reajuste
  (a) a cada 12 meses pelo IPCA ou (b) a qualquer tempo quando a operadora aumentar o custo,
  limitado a esse aumento — sempre com aviso de 30 dias e direito de cancelar sem multa.
- **Dados pessoais (LGPD) e atendimento:** suporte@gigachip.com.br (o e-mail precisa ser criado
  quando o domínio for configurado).
- **WhatsApp:** ainda não existe. Quando a variável `NEXT_PUBLIC_WHATSAPP_NUMBER` for cadastrada, o
  número aparece no site e nos contratos novos automaticamente.
- **Quem assina:** só o cliente.

## D20 — Integração com a D4Sign (20/11/2026)

- Endpoints conferidos no **conector oficial da D4Sign** (`@d4sign/n8n-nodes-d4sign` 1.0.11), já que
  o site da documentação não abre a partir do ambiente de desenvolvimento.
- Fluxo (ver D21): pagamento confirmado → PDF gerado → `uploadbinary` no cofre → `createlist` (cliente, "assinar",
  aviso por e-mail) → `webhooks` (URL com senha) → `sendtosigner`. A D4Sign manda o e-mail ao
  cliente (não depende do nosso domínio).
- O aviso de assinatura é só um "toque": o sistema consulta `GET /documents/{uuid}` e, se
  finalizado, baixa o PDF assinado e guarda **cifrado** (`contract_files`).
- Respeita o limite de **10 chamadas/hora** (`api_call_log`); acima disso o contrato espera na fila.
- Rotina diária (Vercel Cron, plano gratuito) reenvia o que ficou na fila e confere assinaturas.
- **A confirmar no 1º teste real:** códigos de status do documento (4 = finalizado, 6 = cancelado).

## D21 — Contrato enviado assim que o cliente paga (20/11/2026)

**Decisão:** o contrato vai para assinatura **automaticamente quando o pagamento é confirmado**, sem
aprovação manual antes. A validação de identidade acontece **em paralelo** e continua obrigatória
para **ativar a linha** (o pedido só fica "pronto para ativação" com pagamento, identidade
aprovada, contrato assinado e dados do aparelho).

**Consequências:**
- O contrato usa os dados do cadastro inicial (nome, CPF, nascimento, e-mail, celular).
- Se a identidade for reprovada depois da assinatura, vale a cláusula 6.2: a ativação é recusada
  com reembolso integral.
- Cada pedido pago gasta 1 envio da D4Sign, mesmo que a identidade venha a ser recusada.
- Substitui a regra 3 do doc 05 ("contrato só após identidade aprovada").

## D22 — Formulário de ativação por link no e-mail, com leitura do print (20/11/2026)

**Decisão:** o cliente não precisa "entrar numa área". Depois do pagamento ele recebe um **link
para o Formulário de ativação** (`/acesso/<token>` → `/ativacao`), uma página única com:
1. **Dados do celular:** botão "Abrir o discador com *#06#" (Android; o iPhone não permite), o
   cliente tira o **print** e envia; o site **lê os números do print no próprio celular** (OCR,
   tesseract.js) e preenche IMEI/EID (ou ICCID). O cliente confere e envia. O print é guardado
   cifrado (`device_screenshots`, 90 dias provisórios) e a equipe vê no painel.
2. **Documento e selfie.**
3. **Contrato:** aviso de que chegou pela D4Sign.

**Limite técnico importante:** nenhum site consegue ler o IMEI/EID direto do celular (Android e
iOS bloqueiam). Por isso o caminho é o print + leitura automática.

**Onde o link chega:**
- botão na tela de pagamento confirmado;
- **mensagem do contrato na D4Sign** (já funciona, sem domínio próprio);
- **e-mail "Pagamento confirmado"** (Resend) — fica na fila e é enviado quando `RESEND_API_KEY` e
  `EMAIL_FROM` forem configurados (depende do domínio gigachip.com.br).

Os arquivos do leitor (motor + idioma, ~15 MB) são servidos pelo próprio site (`public/ocr`,
copiados de `node_modules` antes do build), sem depender de CDN externo.

## D23 — Corrigir e-mail digitado errado (20/11/2026)

No painel (detalhe do pedido → "Corrigir e-mail do cliente"), dono/administrador/ativador corrige
o e-mail. O sistema:
- atualiza o cadastro e o cliente no Asaas;
- invalida os links de acesso enviados ao e-mail errado (o do navegador da compra continua valendo);
- como o e-mail está escrito dentro do contrato, **cancela o contrato antigo na D4Sign e envia um
  novo** para o e-mail certo (gasta 1 envio a mais) — se ainda não tiver sido assinado;
- reenvia o e-mail do formulário de ativação;
- registra na auditoria (e-mails mascarados).

Antes de trocar, a equipe deve confirmar com o cliente pelo celular cadastrado (evita golpe de
alguém pedindo para trocar o e-mail de outra pessoa).

## D24 — Lições do 1º teste real com a D4Sign (20/11/2026)

- **Funcionou de verdade:** pagamento confirmado → contrato enviado à D4Sign em ~10 s; correção de
  e-mail cancelou o antigo e enviou um novo.
- **Limite de 10 chamadas/hora da D4Sign é fácil de atingir em testes.** Agora o cancelamento do
  contrato antigo entra na fila (`contracts.docs_to_cancel`, migração 0007) e respeita o limite; se
  estiver no limite, o painel avisa e o envio acontece quando liberar.
- **Rotina a cada 10 minutos** pelo Supabase (pg_cron + pg_net, `scripts/supabase/agendar-rotinas.sql`)
  processa a fila de contratos, confere assinaturas e envia e-mails — a rotina da Vercel no plano
  gratuito só roda 1 vez por dia.
- Ações do painel que falam com a D4Sign respondem na hora e fazem o trabalho logo depois (`after`).

## D25 — Identidade validada automaticamente pela D4Sign na assinatura (20/11/2026)

**Decisão:** os sócios não querem aprovar identidade à mão. A conta D4Sign oferece, na assinatura,
**"Exigir documento com foto + selfie com reconhecimento facial"** (campo `docauthandselfie` da API,
confirmado no conector oficial). O sistema passa a cadastrar o signatário com essa exigência e,
quando o contrato é assinado, marca a identidade como **aprovada (provedor d4sign)**.

**Fluxo final:** pagou → contrato da D4Sign (assinatura com documento + selfie) + formulário só com o
print do *#06# → contrato assinado + aparelho informado → **pronto para ativação**. A equipe só ativa.

- Configuração `IDENTITY_MODE` (padrão `d4sign`); `manual` volta ao envio de fotos + aprovação no painel.
- As imagens e o resultado do reconhecimento facial ficam no relatório do documento na D4Sign
  (nada de selfie/documento guardado no nosso banco neste modo — menos dado sensível conosco).
- **A confirmar no 1º teste real:** custo por uso (se consome créditos do plano) e se a D4Sign
  bloqueia a assinatura quando o rosto não confere ou só registra o resultado no relatório.
- Alternativa futura, se precisar de checagem contra base oficial: validador externo (ver pesquisa
  de preços: Validra, Serpro Datavalid, ZapSign ID, unico/CAF/idwall).

## D26 — Estoque de linhas no painel substitui a planilha (20/11/2026)

- Os números da conta Vivo Gestão entram como **"disponível"** (login, número, plano PJ) — colando
  direto da planilha em Painel → Linhas.
- **Ativação** (pedido "pronto para ativação" → "Ativar linha"): o dono escolhe o número disponível e
  digita **só o ICCID** (no chip físico já vem o ICCID informado pelo cliente). O sistema preenche
  os campos da venda: cliente, Smart-Dados ("Franquia de X+YGB"), data de ativação (hoje), venda
  final (preço do pedido), valor do gestor e próximo vencimento. **Login, número, plano PJ e forma
  de pagamento já cadastrados nunca são alterados.**
- **Valor do gestor** (padrão R$ 30) é configurável em Painel → Configurações; cada linha guarda o
  valor da época da ativação.
- Pedido vira **"ativado"** e o cliente recebe o e-mail "Sua linha está ativa" (fila de e-mails).
- Painel → Linhas mostra a "planilha" com filtros e busca, e **Baixar planilha (Excel)** exporta no
  mesmo formato (CSV com ; e acentos para o Excel, protegido contra fórmulas).
- A planilha antiga tem dados pessoais de clientes: compartilhar só com quem precisa. Importar os
  clientes antigos (com `legacy_customer_name`) fica para quando os sócios enviarem o arquivo.

## D27 — Teste real do contrato confirmado; identidade só aprova com selfie exigida (20/11/2026)

- **Confirmado com a D4Sign real:** contrato enviado sozinho após o pagamento, assinado pelo
  cliente, aviso (webhook) recebido e pedido atualizado para "Assinado" automaticamente.
- Ajuste: o contrato agora registra como o signatário foi autenticado (`contracts.signer_auth`,
  migração 0009). A identidade só é aprovada sozinha se o contrato exigiu **documento + selfie**
  (`doc_selfie`). Contratos assinados sem essa exigência (ex.: enviados antes de D25) ficam
  "em análise" para a equipe aprovar no painel.

## D28 — FLUXO OFICIAL DO CLIENTE (definido pelos sócios em 20/11/2026) ⭐

Esta é a referência para qualquer mudança futura. Substitui D21 (contrato no pagamento).

1. **Compra:** o cliente escolhe o plano no site, preenche o cadastro e paga (PIX/cartão — Asaas).
2. **ID do celular:** na tela de parabéns, o botão leva ao **Formulário de ativação**; o cliente
   manda o print do `*#06#` (o site lê IMEI/EID ou ICCID) e confirma. *(O link do formulário também
   vai por e-mail.)*
3. **Contrato:** só **depois do ID do celular** o contrato é enviado pela D4Sign para o e-mail do
   cliente, exigindo **foto do documento + selfie com reconhecimento facial** (validação de
   identidade automática). O formulário mostra o aviso e se atualiza sozinho.
4. **WhatsApp:** com o contrato assinado, o formulário libera o botão **"Enviar dados e pedir
   ativação no WhatsApp"**, com mensagem pronta: pedido, nome, plano, tipo (eSIM/chip), IMEI,
   EID/ICCID e "contrato assinado". **Sem CPF e sem documentos.**
5. **Ativação — MANUAL, feita pelo dono:** ativa a linha no portal da Vivo, fala com o cliente e
   registra no painel em **"Ativar linha"** (escolhe o número disponível, digita o ICCID; o sistema
   preenche as colunas da planilha em Painel → Linhas).

Automático: cobrança, formulário, leitura do print, envio do contrato, validação de identidade
(D4Sign), acompanhamento da assinatura, liberação do WhatsApp, e-mails e lembretes.
Manual: ativar na Vivo, escolher o número/ICCID no painel, conversar com o cliente.

## D29 — Inadimplência no painel (21/11/2026)

Antes: no dia seguinte ao vencimento, o dono olhava no Asaas quem não pagou, procurava o nome na
planilha, pintava de vermelho e bloqueava na Vivo.

Agora (Painel → **Inadimplência**):
- O sistema **puxa do Asaas** as cobranças vencidas (status OVERDUE, que o Asaas marca no dia
  seguinte ao vencimento) — de **todos** os clientes da conta, inclusive os antigos da planilha.
  Atualiza sozinho a cada hora (rotina) e na hora pelos avisos (webhook) do Asaas; há também o
  botão "Atualizar agora".
- Lista **"Bloquear linha — sem pagamento"**: nome, valor, vencimento, dias de atraso, link da
  cobrança e o número da linha (quando o sistema sabe). O dono bloqueia **na Vivo, à mão**, e clica
  **"Bloqueei na Vivo"**. Para clientes da planilha, pode escolher qual é o número (o sistema
  sugere pelo nome) — a ligação fica salva para os próximos meses.
- Pagou estando bloqueado → lista **"Desbloquear — pagou"** → desbloqueia na Vivo (até 24 h, pelo
  contrato) e clica **"Desbloqueei na Vivo"**. A linha volta a "Ativa" na tela Linhas.
- Lista **"Bloqueadas — aguardando pagamento"** mostra há quantos dias; passando de 5 dias fica em
  vermelho (pelo contrato já pode cancelar). **Nada é cancelado sozinho.**
- Pagamento fora do Asaas (ex.: dinheiro): marcar "recebido em dinheiro" no Asaas — o painel segue.
- Tudo fica registrado (quem bloqueou/desbloqueou e quando) no histórico e no audit_log.
- Pedido do site que **não foi pago em 48 h** expira sozinho e a assinatura é **apagada no Asaas**
  (senão o Asaas continuaria gerando cobrança todo mês para quem desistiu). A 1ª mensalidade não
  paga nunca entra na lista de bloqueio (não existe linha).

## D30 — A planilha do gestor (Google Planilhas) continua oficial; o sistema lê e escreve nela (21/11/2026)

O gestor usa a planilha, então ela **não** é substituída (revisa D26). O sistema acessa por um
"usuário robô" (conta de serviço do Google) com quem a planilha é compartilhada como Editor.
- **Lê** (de hora em hora e no botão "Ler planilha agora"): números com "Disponível" (ou vazio) na
  coluna Cliente → disponíveis para
  "Ativar linha"; linhas com cliente → clientes antigos (aparecem em Linhas e na Inadimplência).
  O gestor é quem coloca números novos quando o estoque acaba.
- **Escreve**: na ativação, Cliente, ICCID, Smart-Dados, Ativação, Venda final, Valor e Vencimento;
  no bloqueio, nome em vermelho; no desbloqueio, nome em preto. Login Vivo, Número, Plano PJ e
  Forma de pagamento são do gestor e nunca são alterados.
- Colunas achadas pelo **nome do cabeçalho** (a ordem pode mudar). Linhas achadas pelo **número**.
- Segurança: se o número já tiver outro cliente na planilha, ou aparecer mais de uma vez, não
  escreve nada (aviso no painel).
  Falha do Google → escrita pendente, a rotina tenta de novo.
- Passo a passo de configuração: `docs/guia-planilha-google.md`.
- **Regra do disponível (pedido do dono):** só é disponível o número com **"Disponível" na coluna
  Cliente E com ICCID Atual, Smart-Dados, Ativação, Venda Final, Valor e Vencimento vazios**. Se
  tiver "Disponível" com algum desses preenchido, ou Cliente vazio, o número sai da lista de
  disponíveis, aparece no "Testar planilha" com a linha e o motivo, e o sistema não escreve nele
  até a planilha ser arrumada.
- **Posição na planilha:** a tela Linhas mostra a coluna **"#"** com o número da linha na planilha
  (o mesmo 1, 2, 3 da lateral do Google Planilhas), na mesma ordem da planilha; clicar abre a
  planilha naquela linha. Botão "Abrir planilha" no topo. Atualizado a cada leitura.
- **Mesmo estilo das outras linhas:** ao preencher a venda, o robô copia a formatação (fonte,
  negrito, cor, alinhamento, bordas, formato de data e R$) da linha de cliente mais próxima, e no
  Smart-Dados pinta o trecho numérico (ex.: "100+100") com a mesma cor do modelo.
- **Painel atualiza sozinho:** pedido "Em andamento" confere a cada 15 s (o "Ativar linha" aparece
  quando fica pronto); depois de ativar, confere a cada 3 s até a planilha ser preenchida. Com o
  pedido pronto para ativar, não atualiza (para não atrapalhar quem está digitando).

## D31 — E-mail de contato: contato@gigachip.com.br (21/11/2026)

Substitui o suporte@ (D19): atendimento e privacidade/LGPD passam a ser **contato@gigachip.com.br**
(contrato v4 e rodapé do site). Os e-mails do site saem por esse endereço via Resend
(`EMAIL_FROM="Gigachip <contato@gigachip.com.br>"`); respostas do cliente chegam na caixa normal.

## D32 — "Esqueci minha senha" no painel (21/11/2026)

Na tela de entrar, "Esqueci minha senha" manda um link para o e-mail cadastrado da pessoa da
equipe (pelo Resend). O link vale 30 minutos e uma vez só; até 3 pedidos por hora. A resposta é
sempre a mesma (não revela quem é da equipe). Ao trocar a senha, todas as sessões abertas são
encerradas e o 2FA continua sendo pedido. Migração 0013.

## D33 — Editar linha no painel (21/11/2026)

Painel → Linhas → **Editar**: corrige Cliente (só clientes antigos), ICCID, Smart-Dados, Ativação,
Venda final, Valor do gestor, Vencimento (só clientes antigos) e Observações (só no painel). Com a
planilha ligada, a correção é escrita na planilha do gestor (passando por cima, no mesmo estilo) e
não é desfeita pela leitura seguinte. Login, Número, Plano PJ e Forma de pagamento continuam sendo
do gestor (mudar na planilha). Nome e vencimento dos clientes do site vêm do cadastro/assinatura.
O histórico registra só quais campos mudaram (sem valores). Migração 0014.

## D34 — Regras da planilha editáveis no painel (coluna Gestor) (22/11/2026)

Pedido do dono: os números disponíveis vêm com **"Falta Bloquear Gestor"** ou **"Gestor Bloqueio"**
na coluna **Gestor**; ao ativar, ela passa para **"Gestor Ativo"**. E o dono quer mudar essas regras
sozinho (ex.: o gestor pedir só "Ativo"), sem programador.
- **Painel → Configurações → Regras da planilha** (só o dono). Cada regra: **quando** (ao ativar,
  ao bloquear, ao desbloquear), **coluna** (nome do cabeçalho; maiúsculas e acentos não importam),
  **o que fazer** (escrever um texto, cor do texto, cor do fundo — 8 cores fixas) e, opcional,
  **"só se estiver escrito"** (um ou mais valores separados por ";"). Cada regra mostra a frase do
  que vai fazer, para conferir antes de salvar. "Voltar ao padrão" restaura as de fábrica.
- **De fábrica:** ao ativar, Gestor → "Gestor Ativo" e nome (Cliente) em preto; ao bloquear, nome
  em vermelho; ao desbloquear, nome em preto (o que o sistema já fazia — D30 — virou regra).
- A coluna **Número** não pode ter regra (é ela que liga a planilha ao sistema). Texto nunca vira
  fórmula. Aba sem a coluna da regra: a regra é ignorada ali e o "Testar planilha" avisa.
- "Editar linha" (D33) não aplica os textos das regras, só as cores da ativação. As regras valem
  da próxima escrita em diante (não mudam o que já está na planilha).
- Guardado em `app_settings` (`planilha_regras`), sem migração; quem mudou fica no histórico.

## D35 — Nomes das colunas da planilha editáveis no painel (22/11/2026)

Pedido do dono: se o gestor mudar o nome de uma coluna (ex.: **ICCID** virar **CD**), a planilha
tem que continuar funcionando sem programador.
- **Painel → Configurações → Nomes das colunas da planilha** (só o dono): para cada campo (Cliente,
  Login Vivo, Número, ICCID, Smart-Dados, Plano PJ, Ativação, Venda final, Valor, Vencimento, Forma
  de pagamento), o nome do cabeçalho na planilha. Em branco = reconhece sozinho pelos nomes de
  sempre. Vários nomes separados por ";" (abas com nomes diferentes). Maiúsculas e acentos não
  importam. O mesmo nome não pode estar em dois campos.
- O sistema procura primeiro o nome escolhido; se não achar, usa os nomes de sempre. Coluna
  escolhida para um campo não é usada por outro.
- Sem a coluna Número o sistema não reconhece a aba: o painel avisa para ajustar o nome.
  "Testar planilha" mostra qual coluna foi achada para cada campo.
- As regras (D34) usam o nome da coluna escrito na própria regra (ex.: Gestor): se o gestor
  renomear essa coluna, muda-se a regra.
- Guardado em `app_settings` (`planilha_colunas`), sem migração; quem mudou fica no histórico.

## D36 — O que escrever em cada coluna da planilha, editável no painel (22/11/2026)

Pedido do dono: poder mudar **o que** o sistema escreve em cada coluna na ativação.
- **Painel → Configurações → O que escrever em cada coluna** (só o dono): para Cliente, ICCID,
  Smart-Dados, Ativação, Venda final, Valor e Vencimento, um **modelo** com texto livre e
  **etiquetas** (botões): [Nome do cliente], [Primeiro nome], [Número do pedido], [Plano do site],
  [ICCID], [Smart-Dados], [Data de ativação], [Venda final], [Valor do gestor], [Vencimento],
  [Dia do vencimento]. Ex.: "[Nome do cliente] - pedido [Número do pedido]" → "Beatriz Rocha -
  pedido 8". Prévia com um exemplo embaixo de cada campo; "padrão" por campo e "Voltar tudo ao padrão".
- De fábrica, cada coluna com o seu dado (igual a antes). Etiqueta sozinha de data/R$/ICCID sai no
  formato próprio (data de verdade, moeda, ICCID como texto); misturada com texto, vira texto.
- **Em branco = não escreve** naquela coluna. **Cliente é obrigatório e precisa ter o nome**
  ([Nome do cliente] ou [Primeiro nome]): é por ele que o sistema confere de quem é a linha antes
  de escrever (a conferência aceita o nome puro ou o texto do modelo). Etiqueta desconhecida é
  recusada ao salvar. Texto nunca vira fórmula.
- As regras (D34) também aceitam as etiquetas no "Escrever".
- Vale da próxima escrita em diante. Guardado em `app_settings` (`planilha_modelos`), sem migração;
  quem mudou fica no histórico (só os nomes dos campos).

## D37 — Contrato aprovado pelo advogado e WhatsApp de atendimento (22/11/2026)

- O advogado aprovou o contrato: modelo **v5-2026-11**, **sem** a marca d'água "VERSÃO DE TESTE".
- A cláusula **7. Dados pessoais (LGPD)** foi retirada a pedido dos sócios (junto com as páginas e a
  caixinha de Termos/Privacidade); as cláusulas seguintes foram renumeradas (Atendimento = 7,
  Assinatura eletrônica = 8).
- **WhatsApp de atendimento: (85) 8129-0832** (`WHATSAPP_DEFAULT` em `lib/site.ts`). Aparece no
  contrato, no botão do site e no último passo da ativação. Se a variável
  `NEXT_PUBLIC_WHATSAPP_NUMBER` existir na Vercel, ela vale por cima — deixar igual ou apagar.
- Contratos já gerados antes desta mudança continuam com a versão da época (cada contrato grava a sua).

## D38 — Contratação, pagamento e ativação novos (desenho do Lovable) (22/11/2026)

- **Contratação em 3 etapas** (Seus dados · Sua linha · Pagamento), com máscaras, data de nascimento
  digitada com "/" automática e resumo azul só na 1ª etapa. **Sem a caixinha de aceitar
  Termos/Privacidade** (pedido dos sócios): o servidor não exige mais; só registra o "sim" opcional
  aos avisos pelo WhatsApp.
- **Pagamento**: PIX com QR Code, copia e cola e passo a passo; cartão pela página segura do Asaas;
  tela "Pagamento confirmado" com os próximos passos. A confirmação continua vindo só do webhook.
- **Ativação**:
  - **eSIM** → passo a passo animado do *#06# (iPhone/Android, um passo por vez, botão de copiar o
    código) e envio do **print do registro do eSIM** (IMEI + EID lidos da imagem no próprio celular);
  - **chip físico** → **foto do verso da embalagem lacrada** e o número do chip (ICCID). O IMEI
    deixou de ser pedido no chip físico (migração **0015**). Opção "Ainda não estou com o chip —
    envio depois" (o cliente volta pelo mesmo link do e-mail).
  - Depois: contrato no e-mail (D4Sign) → botão do WhatsApp (D28 continua igual).
- As telas de contratação, pagamento, ativação e área do cliente usam o topo simples (logo +
  "Ambiente seguro"), sem menu, para o cliente não sair no meio do caminho.

## D39 — Inadimplência só com cobranças de linha (valor mínimo) (22/11/2026)

O Asaas usado é o do sócio e também cobra **outros produtos**. As cobranças de linha são sempre de
**R$ 100,00 ou mais**; as menores são de outros produtos e não podem aparecer na Inadimplência.
- Painel → **Configurações → Inadimplência: valor mínimo da cobrança** (só o dono). De fábrica:
  **R$ 100,00**. Use 0,00 para considerar todas.
- A regra vale para a lista (bloquear, desbloquear, bloqueadas), os totais, o contador do menu e
  para as confirmações "Bloqueei/Desbloqueei na Vivo" (uma cobrança pequena de outro produto não
  impede desbloquear a linha).
- O sistema continua puxando todas as cobranças vencidas do Asaas; o filtro é só na exibição, então
  mudar o valor vale na hora, sem precisar puxar de novo. Guardado em `app_settings`
  (`inadimplencia_valor_minimo_cents`), sem migração.

## D40 — A planilha do gestor também manda nas linhas vendidas pelo site (23/11/2026)

Pedido do dono: se ele ou o gestor mexerem na planilha, o painel acompanha.
- A planilha é lida **a cada 10 minutos** (antes, 1 vez por hora) e no botão "Ler planilha agora".
- Linha vendida pelo site, com cliente na planilha: o painel passa a usar o **ICCID/EID, Smart-Dados,
  Ativação, Venda final e Valor** que estiverem na planilha (só o que veio preenchido). Nome e
  vencimento continuam vindo do cadastro e da assinatura do cliente.
- Linha vendida pelo site que **voltou para "Disponível"** na planilha: o número volta para o estoque
  e o pedido volta para **"Pronto para ativar"** (aparece de novo na fila), com o motivo no histórico
  e no audit_log.
- Logo depois de uma ativação ou correção feita no painel (escrita na planilha ainda pendente), a
  leitura não mexe naquela linha, para não desfazer o que a equipe acabou de fazer.

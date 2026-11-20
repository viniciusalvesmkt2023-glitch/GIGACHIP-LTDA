# 06 — Plano do MVP

## 1. Definição do MVP

**Objetivo:** vender e ativar linhas para clientes reais com segurança, tirando do seu pai todo o
trabalho de coleta e conferência.

### Dentro do MVP

- Site: home, catálogo, página de plano, comparação simples, FAQ, botão WhatsApp, rodapé com CNPJ e aviso de parceiro.
- Contratação: cadastro básico + escolha eSIM/chip + modelo do aparelho + aceites (termos, privacidade).
- Pagamento **PIX** pelo Asaas, com webhook, consulta de confirmação, expiração e reconciliação.
- Área do cliente (login por código no e-mail) com checklist do pedido.
- Identidade: **modo conforme resposta da Vivo** (provedor externo, ou modo manual assistido com upload seguro e aprovação no painel).
- Contrato D4Sign (plano A ou B) com webhook de assinatura.
- Coleta de IMEI/EID com instruções por tipo de aparelho e validação de dígito verificador.
- Marcação automática de "pronto para ativação".
- Painel: dashboard com contadores, fila de ativação, lista/busca/filtro de pedidos, detalhe do pedido com histórico, clientes, planos (CRUD), equipe com funções e MFA, auditoria.
- E-mails de todas as etapas + lembretes.
- Política de Privacidade, Termos de Uso, política de reembolso publicadas.

### Fora do MVP (fase 2+)

- Cartão de crédito · cobrança recorrente · WhatsApp Cloud API · OCR do print · portabilidade ·
  cupons/indicação · relatórios financeiros avançados · múltiplas operadoras · app mobile.

## 2. Fases

Cada fase termina com **demonstração em staging** e só segue com seu OK.

### Fase 0 — Destravar (sem código, ~1–2 semanas, depende de terceiros)
- Respostas do doc 00 (principalmente Vivo e D4Sign).
- Contas sandbox: Asaas, D4Sign, provedor de identidade (se aplicável).
- Domínio, e-mail do domínio, número de WhatsApp comercial.
- Advogado: contrato para venda online, termos, privacidade, reembolso.
- Lista inicial de planos.
- **Spike técnico**: script que cria documento na D4Sign sandbox, cadastra signatário, envia e recebe webhook — prova o plano A ou B antes de construir em cima.

### Fase 1 — Fundação
- Repositório Next.js + TypeScript + Tailwind; Supabase local, staging e produção.
- Migrações do modelo de dados (doc 04), RLS, enums, função do "pronto".
- Autenticação: OTP para cliente, senha + MFA para equipe; RBAC.
- Módulo de criptografia de campos + `audit_log`.
- Domínio puro: máquina de estados, validadores de CPF/IMEI/EID — com testes unitários.
- CI no GitHub rodando lint + testes a cada push.

### Fase 2 — Vitrine e pagamento
- Páginas públicas com SEO (metadados, sitemap, dados estruturados).
- Painel: CRUD de planos.
- Fluxo de contratação + cobrança PIX + QR na tela.
- Webhook Asaas (inbox idempotente) + consulta de confirmação + reconciliação + expiração.
- E-mails: cobrança criada, pagamento confirmado.
- **Teste E2E**: compra completa no sandbox até "em andamento".

### Fase 3 — Onboarding pós-pagamento
- Área do cliente com checklist.
- Identidade (provedor ou manual assistido).
- Contrato D4Sign com fila controlada por taxa + webhook + download do assinado.
- Formulário de aparelho com instruções iPhone/Android e validações.
- Lembretes automáticos.
- **Teste E2E**: do pagamento até "pronto para ativação".

### Fase 4 — Operação
- Dashboard com contadores.
- Fila de ativação: assumir pedido, ver dados (com revelação auditada), concluir com MSISDN/QR/ICCID, ou mandar para pendência.
- Gestão de pedidos (filtros, busca por código/CPF-hash/e-mail, histórico), clientes, equipe.
- E-mail de ativação concluída; entrega do QR eSIM na área do cliente.
- Solicitações LGPD (exportar/excluir).

### Fase 5 — Pré-lançamento
- Revisão de segurança do código (incluindo `/security-review` do Claude Code) e checklist abaixo.
- Teste de restauração de backup.
- Configurar Sentry e alertas (webhook falhando, pedido parado).
- **Piloto controlado**: 5–10 clientes conhecidos com cobrança real, pai acompanhando cada etapa.
- Ajustes; depois abertura geral.

## 3. Estratégia de testes

| Tipo | O que cobre |
|------|------------|
| Unidade | Máquina de estados, regra do "pronto", validadores (CPF, Luhn do IMEI, mod 97 do EID), criptografia, permissões por função |
| Integração | Clientes Asaas/D4Sign contra sandbox; processamento de webhooks com payloads reais gravados; idempotência (mesmo webhook 2×) |
| Banco | Políticas RLS: cliente A não lê pedido do cliente B; atendente não lê campo criptografado |
| Ponta a ponta (Playwright) | Compra completa no staging com sandboxes; painel do ativador |
| Manual | Piloto com clientes reais antes da abertura |

## 4. Checklist para ir a produção

- [ ] Perguntas 🔴 do doc 00 respondidas e documentadas
- [ ] Contrato, termos, privacidade e reembolso revisados por advogado
- [ ] Webhooks testados com eventos duplicados e fora de ordem
- [ ] Reconciliação de pagamentos funcionando
- [ ] RLS testado; nenhuma tabela sensível acessível do navegador
- [ ] MFA obrigatório para toda a equipe
- [ ] Segredos de produção diferentes do staging, só no servidor
- [ ] Backup diário ativo e restauração testada
- [ ] SPF/DKIM/DMARC do domínio configurados
- [ ] Monitoramento de erros e alertas ativos
- [ ] Rotina de retenção/exclusão rodando
- [ ] Roteiro de resposta a incidente escrito
- [ ] Piloto concluído sem pendências críticas

## 5. Próximo passo sugerido

1. Você leva o **doc 00** para seu pai e para o contato da Vivo; e solicita acesso à API/sandbox da D4Sign.
2. Enquanto isso, podemos começar a **Fase 1** (fundação) com segurança, porque ela não depende
   dessas respostas — e o **spike da D4Sign** assim que houver credencial de sandbox.

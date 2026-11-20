# 03 — Arquitetura

## 1. Avaliação das ferramentas propostas

| Ferramenta | Veredito | Motivo |
|-----------|:--------:|--------|
| **Supabase** | ✅ Usar | Postgres de verdade (relacional, transações, constraints), autenticação com MFA, storage privado, rotinas agendadas, região São Paulo. Bom custo para o porte. **Exige plano pago em produção** (o gratuito pausa por inatividade e não tem backup diário). |
| **Asaas** | ✅ Usar | Já em uso, API documentada, sandbox, PIX e webhooks. |
| **D4Sign** | ✅ Usar, condicionado | Já em uso e com modelo pronto. Condicionado a: plano com API e aumento do limite de requisições. |
| **Claude Code** | ✅ Usar | Desenvolvimento, testes, revisão de segurança. Funciona melhor com código convencional em repositório (que é a recomendação abaixo). |
| **E-mail transacional** | ✅ Usar | Resend ou Postmark. |
| **WhatsApp Business Platform** | 🟡 Fase 2 | Útil, mas tem custo por mensagem, aprovação de templates e verificação de negócio. O link `wa.me` resolve o MVP. |
| **Lovable** | ⚠️ Só para protótipo visual | Ver abaixo. |

### Por que não construir o produto no Lovable

O Lovable é ótimo para chegar rápido numa tela bonita, mas para **este** sistema tem problemas:

1. **Onde fica a lógica sensível.** Apps gerados por essas ferramentas tendem a falar com o banco
   direto do navegador, dependendo 100% das regras de RLS do Supabase. Em 2025 houve relatos
   públicos de apps feitos com geradores de IA expondo tabelas inteiras por RLS mal configurada.
   Com CPF, documentos e IMEI, um erro desses é um incidente de LGPD.
2. **SEO.** O Lovable gera uma SPA (React + Vite) renderizada no navegador. Para páginas de planos
   ranquearem no Google, renderização no servidor (SSR) é mais confiável.
3. **Webhooks, filas, reconciliação, controle de taxa da D4Sign** — isso é backend de verdade, que
   acabaria espalhado em Edge Functions escritas fora do Lovable de qualquer jeito.
4. **Testes e revisão.** Fluxo de pagamento precisa de testes automatizados e revisão de código.
   Isso é natural num repositório com Claude Code e desconfortável num editor visual.
5. **Dois lugares mexendo no mesmo código** (Lovable + Claude Code) gera conflito e regressão.

**Uso sensato do Lovable:** prototipar o visual da home e das páginas de plano, mostrar ao seu pai,
e depois reaproveitar o layout no projeto principal. Não é obrigatório.

## 2. Stack recomendada

Um único projeto, uma única linguagem (TypeScript), poucos serviços.

| Camada | Escolha | Por quê |
|--------|---------|---------|
| Front + back | **Next.js (App Router) + TypeScript** | Páginas de venda com SSR (SEO), área do cliente, painel admin e rotas de API/webhook no mesmo projeto |
| UI | Tailwind CSS + shadcn/ui | Componentes prontos e acessíveis, visual profissional, fácil de manter |
| Banco, auth, storage | **Supabase** (região São Paulo) | Postgres, Auth com MFA, Storage privado, `pg_cron` |
| Hospedagem | **Vercel** (região `gru1` São Paulo) | Deploy automático a cada push, ambientes de preview |
| Validação de dados | Zod | Mesma validação no formulário e no servidor |
| Rotinas/fila | Tabelas `outbox` e `webhook_events` no Postgres + `pg_cron` chamando uma rota protegida a cada minuto | Sem serviço extra; dá para trocar por Inngest/Trigger.dev se o volume crescer |
| E-mail | Resend (ou Postmark) + React Email | Templates versionados no código |
| Testes | Vitest (unidade), Playwright (ponta a ponta) | Playwright simula o cliente comprando no sandbox |
| Monitoramento de erros | Sentry (plano gratuito) | Saber quando um webhook falha antes do cliente reclamar |
| Repositório | GitHub, branch protegida, CI com testes | |

### Ambientes

| Ambiente | Banco | Integrações |
|----------|-------|-------------|
| Local | Supabase local (CLI/Docker) | Sandboxes + mocks |
| **Staging** | Projeto Supabase separado | Asaas sandbox, D4Sign sandbox, provedor de identidade em modo teste |
| **Produção** | Projeto Supabase separado, plano pago | Contas reais |

Produção **nunca** compartilha banco ou chave com staging.

## 3. Organização do código

```
app/
  (site)/            páginas públicas: home, planos, plano/[slug], faq, contratar
  (cliente)/         área do cliente: login, pedidos, pedido/[codigo] (checklist)
  (admin)/           painel: dashboard, pedidos, fila-ativacao, clientes, planos, equipe, auditoria
  api/
    webhooks/asaas   recebe e enfileira
    webhooks/d4sign
    webhooks/kyc
    cron/            rotas chamadas pelo pg_cron (protegidas por segredo)
lib/
  domain/            regras de negócio puras (máquina de estados, validação IMEI/EID/CPF) — 100% testadas
  integrations/
    asaas/           cliente HTTP + tipos
    d4sign/
    identity/        interface IdentityProvider + implementações (manual, provedor X)
    email/
  db/                acesso ao banco (somente servidor)
  security/          criptografia de campos, auditoria, RBAC
supabase/
  migrations/        SQL versionado
  seed.sql
tests/
  unit/  e2e/
```

Regra de ouro: **o navegador nunca fala direto com tabelas sensíveis.** Toda leitura/escrita de
dados pessoais passa por código no servidor que checa permissão e grava auditoria. RLS fica ativo
em todas as tabelas como segunda barreira (defesa em profundidade), não como única.

## 4. Segurança e LGPD desde o início

### 4.1 Minimização (o dado mais seguro é o que não guardamos)

| Dado | Guardar? | Como |
|------|----------|------|
| Nome, e-mail, celular, nascimento | Sim | Banco, acesso restrito |
| CPF | Sim | **Criptografado** + hash (HMAC) separado para busca e para impedir duplicidade |
| Selfie, documento | **Não, se houver provedor** | Só status + id no provedor. Sem provedor: bucket privado, criptografado, exclusão programada |
| IMEI, EID | Sim (necessário para ativar) | Criptografado; mostrado mascarado, revelação registrada em auditoria |
| Print do `*#06#` | Só se a Vivo exigir | Bucket privado, exclusão programada |
| Dados de cartão | **Nunca** | Ficam no Asaas |
| QR Code de eSIM | O mínimo | Exibido na área do cliente; expira/é apagado após o cliente confirmar a instalação |
| Contrato assinado | Sim | Bucket privado + referência D4Sign |

### 4.2 Controles

- **Criptografia em trânsito** (HTTPS em tudo) e **em repouso** (Supabase criptografa o disco;
  campos críticos têm criptografia adicional na aplicação, AES-256-GCM, chave em variável secreta
  do servidor, nunca no banco nem no código).
- **Autenticação**: clientes com código por e-mail (OTP); equipe com e-mail + senha + **MFA obrigatório (TOTP)**.
- **Autorização por função (RBAC)**:

  | Função | Pode |
  |--------|------|
  | `owner` | Tudo, inclusive gerenciar equipe e ver auditoria |
  | `admin` | Pedidos, clientes, planos, reembolsos |
  | `ativador` | Fila de ativação; ver dados completos **só** de pedidos prontos/em ativação |
  | `atendente` | Buscar pedido, ver status e dados mascarados, registrar atendimento |
  | `financeiro` | Pagamentos e relatórios, sem documentos |

- **Dados mascarados por padrão** no painel (`***.456.789-**`). Botão "revelar" grava quem, quando e por quê.
- **Auditoria**: toda mudança de status, toda revelação de dado sensível, todo login da equipe e
  toda alteração de plano/preço vai para `audit_log` (somente inserção, ninguém edita).
- **Webhooks autenticados**: Asaas por token em header (comparação em tempo constante); D4Sign
  conforme a página de segurança de webhook; provedor de identidade conforme a documentação dele.
  Em todos: re-consultar a API antes de mudar estado.
- **Segredos** só em variáveis de ambiente do servidor (Vercel/Supabase). Nada de chave no front.
- **Links**: área do cliente exige login; arquivos só por URL assinada de curta duração (ex.: 60 s).
- **Proteções web**: rate limit em login e formulários, CAPTCHA invisível no cadastro (ex.: Cloudflare Turnstile), cabeçalhos de segurança (CSP).
- **Backups**: diário automático do plano pago do Supabase; avaliar PITR (recuperação ponto a
  ponto) quando houver volume. **Testar restauração** uma vez antes do lançamento.
- **Retenção e exclusão**: rotina agendada aplica a política de retenção (prazos definidos com o
  advogado — doc 00) e registra cada exclusão.
- **Direitos do titular (LGPD art. 18)**: área do cliente permite baixar os próprios dados e pedir
  exclusão; o pedido cai numa fila do painel (exclusão respeita prazos legais de guarda).
- **Incidente**: roteiro escrito de resposta a incidente (quem avisar, como revogar chaves, prazo
  de comunicação à ANPD e aos titulares).

### 4.3 Contratos com fornecedores

Supabase, Vercel, Asaas, D4Sign, provedor de identidade e e-mail são **operadores** de dados
pessoais. Guardar os termos de processamento de dados (DPA) de cada um e listar todos na Política
de Privacidade.

## 5. Custos de infraestrutura (ordem de grandeza — conferir preços atuais)

| Item | Referência |
|------|-----------|
| Supabase Pro | ~US$ 25/mês por projeto de produção (staging pode ficar no gratuito) |
| Vercel Pro | ~US$ 20/mês por membro (o plano gratuito não é para uso comercial) |
| E-mail transacional | Gratuito até alguns milhares de e-mails/mês no Resend; depois por volume |
| Domínio `.com.br` | ~R$ 40/ano |
| Sentry | Gratuito no início |
| Asaas | Taxa por transação (conferir na conta) |
| D4Sign | Plano atual (+ upgrade se a API exigir) |
| Identidade | Por verificação — **cotar**; pode ser zero se a Vivo fizer a biometria |
| WhatsApp (fase 2) | Por mensagem, conforme tabela da Meta |

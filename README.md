# GIGACHIP — Plataforma de Vendas e Ativação de Linhas

Plataforma própria para vender planos de telefonia móvel (parceria comercial Vivo) pela internet,
automatizar cadastro, pagamento, validação de identidade, contrato eletrônico e coleta de dados do
aparelho, deixando para a equipe apenas a **ativação manual** no canal autorizado e o tratamento
de exceções.

> Status: **Fase 2 (site, contratação e pagamento)** implementada e testada localmente. Nada aqui deve ir para produção antes de resolver as
> perguntas bloqueantes em [`docs/00-perguntas-em-aberto.md`](docs/00-perguntas-em-aberto.md).

## Desenvolvimento

Requisitos: Node 22, Postgres 16 local (para os testes de banco).

```bash
npm install
cp .env.example .env.local   # preencha (para testes locais: banco local + Asaas falso)
npm run dev:asaas-mock       # Asaas falso em http://127.0.0.1:4010/v3 (opcional)
npm run dev                  # site em http://localhost:3000
npm test             # regras de negócio (validadores, estados, multa)
npm run db:check     # aplica as migrações num Postgres temporário e testa as regras do banco
npm run lint && npm run typecheck && npm run build
```

Estrutura:

| Pasta | Conteúdo |
|-------|----------|
| `app/` | Páginas (Next.js App Router) |
| `lib/domain/` | Regras de negócio puras e testadas |
| `supabase/migrations/` | Schema do banco (SQL versionado), RLS e regras automáticas |
| `supabase/seed.sql` | Planos iniciais |
| `tests/unit/`, `tests/db/` | Testes |
| `docs/` | Arquitetura, decisões e contrato |

Segredos: copie `.env.example` para `.env.local`. **Nunca** faça commit de chaves.

## Documentação

| # | Documento | Conteúdo |
|---|-----------|----------|
| 00 | [Perguntas em aberto](docs/00-perguntas-em-aberto.md) | O que precisa ser confirmado com Vivo, D4Sign, Asaas, advogado etc. antes de codar |
| 01 | [Análise estratégica](docs/01-analise-estrategica.md) | Problemas da ideia, melhorias, jornada do cliente, manual × automático, riscos |
| 02 | [Integrações](docs/02-integracoes.md) | Asaas, D4Sign, verificação de identidade, e-mail, WhatsApp, OCR — o que é confirmado e o que falta testar |
| 03 | [Arquitetura](docs/03-arquitetura.md) | Avaliação das ferramentas, stack recomendada, segurança e LGPD |
| 04 | [Modelo de dados](docs/04-modelo-de-dados.md) | Tabelas, relacionamentos e regras de acesso |
| 05 | [Estados do pedido](docs/05-estados-do-pedido.md) | Máquina de estados e regras de transição |
| 06 | [Plano do MVP](docs/06-plano-mvp.md) | Escopo do MVP, fases, testes e critérios para ir a produção |
| 07 | [Registro de decisões](docs/07-decisoes.md) | Decisões dos sócios — **prevalece sobre os demais documentos** |
| — | [Análise do contrato](docs/contrato/analise-contrato-atual.md) · [Modelo v2](docs/contrato/modelo-contrato-v2.md) | Contrato atual e proposta para o fluxo online |

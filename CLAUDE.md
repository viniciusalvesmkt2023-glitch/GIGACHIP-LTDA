@AGENTS.md

# Projeto GIGACHIP

Plataforma de venda e ativação de linhas móveis (parceria Vivo). Ativação na Vivo é MANUAL; o
sistema automatiza o resto. Leia `README.md` e `docs/07-decisoes.md` (prevalece sobre os demais docs).

- Idioma do produto, documentação e mensagens de commit: português do Brasil.
- Regras de negócio em `lib/domain/` (puras, com testes em `tests/unit/`). Regras equivalentes no
  banco ficam em `supabase/migrations/` e são testadas por `npm run db:check`.
- Nunca confirmar pagamento pelo front-end; só via webhook autenticado + consulta à API do Asaas.
- Dados sensíveis (CPF, IMEI, EID, ICCID) são cifrados na aplicação; nunca em logs, e-mails ou URLs.
- Navegador nunca acessa tabelas sensíveis; acesso via servidor com checagem de função + audit_log.
- Antes de concluir: `npm run lint && npm run typecheck && npm test && npm run db:check`.

-- Contratos antigos que precisam ser cancelados na D4Sign antes de enviar o novo (D23).
-- Fazer o cancelamento DENTRO da fila garante que ele respeita o limite de chamadas por hora
-- e não se perde se a D4Sign estiver no limite.
alter table public.contracts
  add column if not exists docs_to_cancel text[] not null default '{}';

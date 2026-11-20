-- Acesso do cliente à "Minha área" sem senha: token aleatório entregue por cookie (mesmo
-- navegador da compra) ou por link no e-mail. Só o HASH do token é guardado.
create table public.order_access_tokens (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  token_hash    text not null unique,          -- sha256 hex do token
  created_via   text not null check (created_via in ('checkout', 'email')),
  expires_at    timestamptz not null,
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index order_access_tokens_order_idx on public.order_access_tokens (order_id);
alter table public.order_access_tokens enable row level security;
-- sem políticas: acesso só pelo servidor
revoke insert, update, delete on public.order_access_tokens from anon, authenticated;

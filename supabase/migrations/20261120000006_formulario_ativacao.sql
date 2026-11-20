-- Formulário de ativação (D22): print do *#06# enviado pelo cliente, cifrado, com prazo de exclusão.
create table public.device_screenshots (
  order_id           uuid primary key references public.orders (id) on delete cascade,
  mime_type          text not null,
  size_bytes         int not null,
  sha256             text not null,
  content_encrypted  bytea not null,
  delete_after       timestamptz not null,
  created_at         timestamptz not null default now()
);
alter table public.device_screenshots enable row level security;
revoke all on public.device_screenshots from anon, authenticated;

-- Link do formulário também pode ir na mensagem da D4Sign
alter table public.order_access_tokens drop constraint if exists order_access_tokens_created_via_check;
alter table public.order_access_tokens
  add constraint order_access_tokens_created_via_check check (created_via in ('checkout', 'email', 'd4sign'));

-- "Esqueci minha senha" do painel: link de uso único, válido por 30 minutos, enviado ao e-mail
-- cadastrado da pessoa da equipe. Só o hash do link é guardado. O 2FA continua exigido depois.
create table public.staff_password_resets (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid not null references public.staff (id) on delete cascade,
  token_hash  text not null unique,
  ip          inet,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index staff_password_resets_staff_idx on public.staff_password_resets (staff_id, created_at);

alter table public.staff_password_resets enable row level security;
revoke all on public.staff_password_resets from anon, authenticated;

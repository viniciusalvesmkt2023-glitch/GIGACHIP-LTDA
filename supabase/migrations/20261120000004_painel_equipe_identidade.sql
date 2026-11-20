-- =============================================================================
-- Painel da equipe (login próprio com senha + 2FA obrigatório) e arquivos de identidade
-- cifrados no próprio banco (D16, D17).
-- =============================================================================

-- Equipe: login próprio (não usa Supabase Auth)
alter table public.staff alter column auth_user_id drop not null;
alter table public.staff
  add column if not exists email extensions.citext,
  add column if not exists password_hash text,
  add column if not exists totp_secret_encrypted bytea,     -- 2FA confirmado
  add column if not exists totp_pending_encrypted bytea,    -- 2FA em cadastro
  add column if not exists last_login_at timestamptz;
create unique index if not exists staff_email_key on public.staff (email);

create table public.staff_sessions (
  id            uuid primary key default gen_random_uuid(),
  staff_id      uuid not null references public.staff (id) on delete cascade,
  token_hash    text not null unique,
  mfa_verified  boolean not null default false,
  ip            inet,
  user_agent    text,
  expires_at    timestamptz not null,
  last_seen_at  timestamptz not null default now(),
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index staff_sessions_staff_idx on public.staff_sessions (staff_id);

-- Tentativas de login (limite contra força bruta)
create table public.staff_login_attempts (
  id          bigint generated always as identity primary key,
  email       extensions.citext not null,
  ip          inet,
  success     boolean not null,
  created_at  timestamptz not null default now()
);
create index staff_login_attempts_email_idx on public.staff_login_attempts (email, created_at);

-- Arquivos de identidade: conteúdo CIFRADO na aplicação, separado dos metadados
alter table public.identity_files
  add column if not exists mime_type text,
  add column if not exists size_bytes int,
  alter column storage_path drop not null;

create table public.identity_file_blobs (
  file_id     uuid primary key references public.identity_files (id) on delete cascade,
  content_encrypted bytea not null
);

alter table public.staff_sessions        enable row level security;
alter table public.staff_login_attempts  enable row level security;
alter table public.identity_file_blobs   enable row level security;
revoke all on public.staff_sessions, public.staff_login_attempts, public.identity_file_blobs from anon, authenticated;

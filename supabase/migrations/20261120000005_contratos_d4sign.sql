-- Contratos na D4Sign (D19, D20): PDF assinado guardado cifrado e controle de limite da API.

-- Cópia do contrato ASSINADO (com o relatório de assinaturas da D4Sign), cifrada na aplicação
create table public.contract_files (
  contract_id        uuid primary key references public.contracts (id) on delete cascade,
  content_encrypted  bytea not null,
  sha256             text not null,
  created_at         timestamptz not null default now()
);

-- Registro de chamadas às APIs externas com limite por hora (D4Sign: 10/h no plano padrão)
create table public.api_call_log (
  id          bigint generated always as identity primary key,
  provider    text not null,
  endpoint    text not null,
  created_at  timestamptz not null default now()
);
create index api_call_log_provider_time_idx on public.api_call_log (provider, created_at);

-- Progresso do envio (para retomar sem repetir etapas se algo falhar no meio)
alter table public.contracts
  add column if not exists step text not null default 'gerar_pdf'
    check (step in ('gerar_pdf', 'cadastrar_signatario', 'registrar_webhook', 'enviar', 'concluido')),
  add column if not exists next_attempt_at timestamptz not null default now();
create index if not exists contracts_queue_idx on public.contracts (next_attempt_at) where status = 'queued';

alter table public.contract_files enable row level security;
alter table public.api_call_log   enable row level security;
revoke all on public.contract_files, public.api_call_log from anon, authenticated;

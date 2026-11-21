-- =============================================================================
-- Inadimplência (D29): o sistema puxa do Asaas as cobranças vencidas e monta as listas
-- "Bloquear linha — sem pagamento" e "Desbloquear — pagou". Bloquear/desbloquear continua
-- MANUAL na Vivo; a equipe só confirma no painel.
--
-- Vale para TODOS os clientes da conta do Asaas (inclusive os antigos da planilha), por isso o
-- vínculo é pelo cliente do Asaas (provider_customer_id), não pelo pedido do site.
-- =============================================================================

-- Cobranças que já venceram sem pagamento (espelho do Asaas, atualizado pela rotina e pelo webhook)
create table public.overdue_payments (
  provider_payment_id   text primary key,
  provider_customer_id  text not null,
  customer_name         text not null,
  value_cents           int not null check (value_cents >= 0),
  due_date              date not null,
  invoice_url           text,
  status                text not null default 'em_aberto'
                        check (status in ('em_aberto', 'pago', 'sem_atraso')), -- sem_atraso: removida, estornada ou vencimento alterado
  paid_at               timestamptz,
  first_seen_at         timestamptz not null default now(),
  checked_at            timestamptz not null default now()
);
create index overdue_payments_open_idx on public.overdue_payments (provider_customer_id) where status = 'em_aberto';

-- Bloqueios feitos na Vivo (histórico). Bloqueio "aberto" = unblocked_at nulo.
create table public.line_blocks (
  id                    uuid primary key default gen_random_uuid(),
  provider_customer_id  text not null,
  customer_name         text not null,
  line_id               uuid references public.lines (id),
  reason                text not null default 'sem_pagamento',
  blocked_by            uuid not null references public.staff (id),
  blocked_at            timestamptz not null default now(),
  unblocked_by          uuid references public.staff (id),
  unblocked_at          timestamptz,
  check ((unblocked_at is null) = (unblocked_by is null))
);
-- Um cliente só pode ter um bloqueio aberto por vez
create unique index line_blocks_one_open_idx on public.line_blocks (provider_customer_id) where unblocked_at is null;

-- Linhas antigas (planilha) podem ser ligadas ao cliente do Asaas para aparecer o número na lista
alter table public.lines add column if not exists asaas_customer_id text;
create index if not exists lines_asaas_customer_idx on public.lines (asaas_customer_id);

alter table public.overdue_payments enable row level security;
alter table public.line_blocks enable row level security;
revoke all on public.overdue_payments from anon, authenticated;
revoke all on public.line_blocks from anon, authenticated;

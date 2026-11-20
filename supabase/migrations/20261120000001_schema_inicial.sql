-- =============================================================================
-- GIGACHIP — schema inicial (Fase 1)
-- Referências: docs/04-modelo-de-dados.md, docs/05-estados-do-pedido.md,
--              docs/07-decisoes.md (D1–D8)
--
-- Princípios:
--  * RLS ativo em TODAS as tabelas. O painel e as integrações usam a chave de
--    serviço no SERVIDOR (que ignora RLS) e checam permissão no código; as
--    políticas abaixo são a segunda barreira, para acessos do navegador.
--  * Campos *_encrypted são cifrados pela aplicação (AES-256-GCM); a chave
--    nunca fica no banco.
--  * Tabelas de histórico (audit_log, order_events) são somente inserção.
--  * Valores monetários em centavos (integer).
-- =============================================================================

create extension if not exists citext;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.staff_role as enum ('owner', 'admin', 'ativador', 'atendente', 'financeiro');
create type public.sim_type as enum ('esim', 'physical');
create type public.order_status as enum (
  'rascunho', 'aguardando_pagamento', 'em_andamento', 'pronto_para_ativacao',
  'em_ativacao', 'ativado', 'pendencia', 'expirado', 'cancelado', 'cancelado_reembolso'
);
create type public.payment_status as enum (
  'pending', 'confirmed', 'received', 'overdue', 'refunded', 'chargeback', 'cancelled'
);
create type public.identity_status as enum (
  'not_started', 'pending_documents', 'in_review', 'approved', 'rejected', 'retry_required'
);
create type public.contract_status as enum (
  'not_created', 'queued', 'sent', 'signed', 'refused', 'cancelled', 'error'
);
create type public.device_status as enum ('pending', 'submitted', 'confirmed', 'invalid');
create type public.billing_type as enum ('pix', 'boleto', 'credit_card', 'undefined');
create type public.subscription_status as enum ('active', 'overdue', 'cancelled');
create type public.line_status as enum ('ativa', 'suspensa', 'cancelada');
create type public.actor_type as enum ('system', 'customer', 'staff', 'webhook');
create type public.notification_channel as enum ('email', 'whatsapp');
create type public.queue_status as enum ('queued', 'processing', 'done', 'failed');
create type public.consent_type as enum ('termos', 'privacidade', 'whatsapp', 'marketing');
create type public.data_request_type as enum ('export', 'delete', 'correct');

-- -----------------------------------------------------------------------------
-- Utilitários
-- -----------------------------------------------------------------------------
create or replace function public.gc_set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.gc_block_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'tabela % é somente inserção', tg_table_name;
end $$;

-- -----------------------------------------------------------------------------
-- Equipe
-- -----------------------------------------------------------------------------
create table public.staff (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null unique references auth.users (id) on delete restrict,
  name          text not null,
  role          public.staff_role not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger staff_updated_at before update on public.staff
  for each row execute function public.gc_set_updated_at();

-- Funções auxiliares para políticas RLS
create or replace function public.gc_current_staff_role() returns public.staff_role
language sql stable security definer set search_path = public as $$
  select role from public.staff where auth_user_id = auth.uid() and is_active
$$;

create or replace function public.gc_is_staff(roles public.staff_role[] default null) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff
    where auth_user_id = auth.uid() and is_active
      and (roles is null or role = any (roles))
  )
$$;

-- -----------------------------------------------------------------------------
-- Catálogo
-- -----------------------------------------------------------------------------
create table public.plan_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.plans (
  id                  uuid primary key default gen_random_uuid(),
  category_id         uuid references public.plan_categories (id),
  slug                text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name                text not null,
  short_description   text,
  description         text,
  data_base_gb        int not null check (data_base_gb > 0),
  data_bonus_gb       int not null default 0 check (data_bonus_gb >= 0),
  data_total_gb       int generated always as (data_base_gb + data_bonus_gb) stored,
  monthly_price_cents int not null check (monthly_price_cents > 0),
  benefits            jsonb not null default '[]'::jsonb,
  sim_types_allowed   public.sim_type[] not null default array['esim', 'physical']::public.sim_type[],
  vivo_reference      text,               -- nome/código do plano no portal Vivo (uso interno)
  is_active           boolean not null default true,
  sort_order          int not null default 0,
  seo_title           text,
  seo_description     text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger plans_updated_at before update on public.plans
  for each row execute function public.gc_set_updated_at();

-- -----------------------------------------------------------------------------
-- Clientes
-- -----------------------------------------------------------------------------
create table public.customers (
  id                  uuid primary key default gen_random_uuid(),
  auth_user_id        uuid unique references auth.users (id) on delete set null,
  full_name           text not null,
  cpf_encrypted       bytea not null,
  cpf_hash            text not null unique,      -- HMAC-SHA256 do CPF (busca/duplicidade)
  cpf_last_digits     text not null check (cpf_last_digits ~ '^\d{2}$'),
  birth_date          date not null,
  email               citext not null,
  phone_e164          text not null check (phone_e164 ~ '^\+55\d{10,11}$'),
  whatsapp_opt_in_at  timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index customers_email_idx on public.customers (email);
create trigger customers_updated_at before update on public.customers
  for each row execute function public.gc_set_updated_at();

create table public.consents (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references public.customers (id) on delete cascade,
  type              public.consent_type not null,
  document_version  text not null,
  granted_at        timestamptz not null default now(),
  revoked_at        timestamptz,
  ip                inet,
  user_agent        text
);
create index consents_customer_idx on public.consents (customer_id);

-- -----------------------------------------------------------------------------
-- Pedidos
-- -----------------------------------------------------------------------------
create sequence public.order_code_seq;

create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  customer_id       uuid not null references public.customers (id) on delete restrict,
  plan_id           uuid not null references public.plans (id) on delete restrict,
  plan_snapshot     jsonb not null,     -- cópia do plano/preço no momento da compra
  monthly_price_cents int not null check (monthly_price_cents > 0),
  sim_type          public.sim_type not null,
  status            public.order_status not null default 'rascunho',
  payment_status    public.payment_status not null default 'pending',
  identity_status   public.identity_status not null default 'not_started',
  contract_status   public.contract_status not null default 'not_created',
  device_status     public.device_status not null default 'pending',
  problem_reason    text,
  assigned_to       uuid references public.staff (id),
  expires_at        timestamptz,
  paid_at           timestamptz,
  ready_at          timestamptz,
  activated_at      timestamptz,
  cancelled_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint pendencia_tem_motivo check (status <> 'pendencia' or problem_reason is not null),
  constraint em_ativacao_tem_responsavel check (status <> 'em_ativacao' or assigned_to is not null)
);
create index orders_status_idx on public.orders (status);
create index orders_customer_idx on public.orders (customer_id);
create trigger orders_updated_at before update on public.orders
  for each row execute function public.gc_set_updated_at();

-- Código público GC-AAAA-NNNNN
create or replace function public.gc_orders_set_code() returns trigger
language plpgsql as $$
begin
  if new.code is null then
    new.code := 'GC-' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYY') || '-'
                || lpad(nextval('public.order_code_seq')::text, 5, '0');
  end if;
  return new;
end $$;
create trigger orders_set_code before insert on public.orders
  for each row execute function public.gc_orders_set_code();

-- Histórico de mudanças do pedido (somente inserção)
create table public.order_events (
  id           bigint generated always as identity primary key,
  order_id     uuid not null references public.orders (id) on delete cascade,
  field        text not null,
  from_value   text,
  to_value     text,
  actor_type   public.actor_type not null default 'system',
  actor_id     uuid,
  reason       text,
  created_at   timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);
create trigger order_events_append_only before update or delete on public.order_events
  for each row execute function public.gc_block_mutation();

-- Regra do "pronto para ativação" + registro automático do histórico.
-- A aplicação define o ator da transação com:
--   select set_config('gc.actor_type', 'staff', true), set_config('gc.actor_id', '<uuid>', true);
create or replace function public.gc_orders_apply_rules() returns trigger
language plpgsql as $$
declare
  v_actor_type public.actor_type := coalesce(nullif(current_setting('gc.actor_type', true), ''), 'system')::public.actor_type;
  v_actor_id   uuid := nullif(current_setting('gc.actor_id', true), '')::uuid;
  v_reason     text := nullif(current_setting('gc.reason', true), '');
begin
  -- 1) pago → em andamento
  if new.status = 'aguardando_pagamento' and new.payment_status in ('confirmed', 'received') then
    new.status := 'em_andamento';
    new.paid_at := coalesce(new.paid_at, now());
  end if;

  -- 2) checklist completo → pronto para ativação
  if new.status = 'em_andamento'
     and new.payment_status in ('confirmed', 'received')
     and new.identity_status = 'approved'
     and new.contract_status = 'signed'
     and new.device_status = 'confirmed' then
    new.status := 'pronto_para_ativacao';
    new.ready_at := now();
  end if;

  -- 3) estorno/chargeback antes da ativação → pendência
  if new.payment_status in ('refunded', 'chargeback')
     and new.status in ('em_andamento', 'pronto_para_ativacao', 'em_ativacao') then
    new.status := 'pendencia';
    new.problem_reason := coalesce(new.problem_reason, 'pagamento_estornado');
  end if;

  -- 4) contrato com erro ou recusado → pendência
  if new.contract_status in ('error', 'refused')
     and new.status in ('em_andamento', 'pronto_para_ativacao') then
    new.status := 'pendencia';
    new.problem_reason := coalesce(new.problem_reason,
      case new.contract_status when 'error' then 'contrato_erro' else 'contrato_recusado' end);
  end if;

  if new.status = 'ativado' then new.activated_at := coalesce(new.activated_at, now()); end if;
  if new.status in ('cancelado', 'cancelado_reembolso') then new.cancelled_at := coalesce(new.cancelled_at, now()); end if;

  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into public.order_events (order_id, field, from_value, to_value, actor_type, actor_id, reason)
      values (new.id, 'status', old.status::text, new.status::text, v_actor_type, v_actor_id, coalesce(v_reason, new.problem_reason));
    end if;
    if new.payment_status is distinct from old.payment_status then
      insert into public.order_events (order_id, field, from_value, to_value, actor_type, actor_id)
      values (new.id, 'payment_status', old.payment_status::text, new.payment_status::text, v_actor_type, v_actor_id);
    end if;
    if new.identity_status is distinct from old.identity_status then
      insert into public.order_events (order_id, field, from_value, to_value, actor_type, actor_id)
      values (new.id, 'identity_status', old.identity_status::text, new.identity_status::text, v_actor_type, v_actor_id);
    end if;
    if new.contract_status is distinct from old.contract_status then
      insert into public.order_events (order_id, field, from_value, to_value, actor_type, actor_id)
      values (new.id, 'contract_status', old.contract_status::text, new.contract_status::text, v_actor_type, v_actor_id);
    end if;
    if new.device_status is distinct from old.device_status then
      insert into public.order_events (order_id, field, from_value, to_value, actor_type, actor_id)
      values (new.id, 'device_status', old.device_status::text, new.device_status::text, v_actor_type, v_actor_id);
    end if;
  end if;
  return new;
end $$;
create trigger orders_apply_rules before insert or update on public.orders
  for each row execute function public.gc_orders_apply_rules();

-- -----------------------------------------------------------------------------
-- Cobrança (Asaas) — mensalidade recorrente (D7)
-- -----------------------------------------------------------------------------
create table public.subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  order_id                  uuid not null unique references public.orders (id) on delete restrict,
  provider                  text not null default 'asaas',
  provider_customer_id      text not null,
  provider_subscription_id  text unique,
  billing_type              public.billing_type not null default 'pix',
  monthly_price_cents       int not null check (monthly_price_cents > 0),
  due_day                   smallint check (due_day between 1 and 28),
  status                    public.subscription_status not null default 'active',
  cancelled_at              timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.gc_set_updated_at();

create table public.payments (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references public.orders (id) on delete restrict,
  subscription_id       uuid references public.subscriptions (id),
  provider              text not null default 'asaas',
  provider_payment_id   text not null unique,
  billing_type          public.billing_type not null,
  amount_cents          int not null check (amount_cents > 0),
  due_date              date not null,
  status                public.payment_status not null default 'pending',
  invoice_url           text,
  is_first_payment      boolean not null default false,
  paid_at               timestamptz,
  refunded_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id);
create index payments_status_due_idx on public.payments (status, due_date);
-- No máximo UMA primeira cobrança pendente por pedido (evita cobrança duplicada)
create unique index payments_one_pending_first_per_order
  on public.payments (order_id) where is_first_payment and status = 'pending';
create trigger payments_updated_at before update on public.payments
  for each row execute function public.gc_set_updated_at();

-- -----------------------------------------------------------------------------
-- Identidade (D3 — modo manual assistido no MVP)
-- -----------------------------------------------------------------------------
create table public.identity_checks (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null unique references public.orders (id) on delete cascade,
  provider            text not null default 'manual',
  provider_reference  text,
  status              public.identity_status not null default 'not_started',
  attempts            smallint not null default 0,
  rejection_reason    text,
  reviewed_by         uuid references public.staff (id),
  decided_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger identity_checks_updated_at before update on public.identity_checks
  for each row execute function public.gc_set_updated_at();

create table public.identity_files (
  id                  uuid primary key default gen_random_uuid(),
  identity_check_id   uuid not null references public.identity_checks (id) on delete cascade,
  kind                text not null check (kind in ('selfie', 'doc_front', 'doc_back')),
  storage_path        text not null,          -- bucket privado
  sha256              text not null,
  delete_after        timestamptz not null,   -- política de retenção
  deleted_at          timestamptz,
  created_at          timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Contrato (D4Sign — D6)
-- -----------------------------------------------------------------------------
create table public.contracts (
  id                      uuid primary key default gen_random_uuid(),
  order_id                uuid not null unique references public.orders (id) on delete restrict,
  provider                text not null default 'd4sign',
  provider_document_uuid  text unique,
  template_version        text not null,
  pdf_sha256              text,
  status                  public.contract_status not null default 'not_created',
  signed_file_path        text,
  attempts                smallint not null default 0,
  last_error              text,
  sent_at                 timestamptz,
  signed_at               timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create trigger contracts_updated_at before update on public.contracts
  for each row execute function public.gc_set_updated_at();

-- -----------------------------------------------------------------------------
-- Aparelho / chip (D4)
-- -----------------------------------------------------------------------------
create table public.device_info (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null unique references public.orders (id) on delete cascade,
  imei_encrypted      bytea not null,
  imei_last4          text not null check (imei_last4 ~ '^\d{4}$'),
  eid_encrypted       bytea,     -- obrigatório para eSIM
  iccid_encrypted     bytea,     -- obrigatório para chip físico lacrado
  checksum_warnings   text[] not null default '{}',
  screenshot_path     text,
  screenshot_delete_after timestamptz,
  source              text not null default 'typed' check (source in ('typed', 'ocr_confirmed')),
  confirmed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger device_info_updated_at before update on public.device_info
  for each row execute function public.gc_set_updated_at();

-- -----------------------------------------------------------------------------
-- Linha fornecida (ativação + ciclo de vida) — D7
-- -----------------------------------------------------------------------------
create table public.lines (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null unique references public.orders (id) on delete restrict,
  msisdn              text not null unique check (msisdn ~ '^\+55\d{10,11}$'),
  status              public.line_status not null default 'ativa',
  vivo_protocol       text,
  activated_by        uuid not null references public.staff (id),
  activated_at        timestamptz not null default now(),
  benefit_description text,
  benefit_cents       int not null default 0 check (benefit_cents >= 0),
  loyalty_days        smallint not null default 90,
  suspended_at        timestamptz,
  cancelled_at        timestamptz,
  cancellation_fine_cents int,
  esim_qr_path        text,        -- bucket privado; apagado após confirmação de instalação
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger lines_updated_at before update on public.lines
  for each row execute function public.gc_set_updated_at();

-- -----------------------------------------------------------------------------
-- Integrações: inbox de webhooks, fila de jobs e outbox de notificações
-- -----------------------------------------------------------------------------
create table public.webhook_events (
  id             bigint generated always as identity primary key,
  provider       text not null,
  event_id       text not null,
  event_type     text not null,
  payload        jsonb not null,
  received_at    timestamptz not null default now(),
  processed_at   timestamptz,
  attempts       smallint not null default 0,
  last_error     text,
  unique (provider, event_id)    -- idempotência: o mesmo evento nunca é processado 2x
);
create index webhook_events_pending_idx on public.webhook_events (received_at) where processed_at is null;

create table public.integration_jobs (
  id           bigint generated always as identity primary key,
  kind         text not null,             -- ex.: 'd4sign.send_contract'
  order_id     uuid references public.orders (id) on delete cascade,
  payload      jsonb not null default '{}'::jsonb,
  status       public.queue_status not null default 'queued',
  run_after    timestamptz not null default now(),
  attempts     smallint not null default 0,
  last_error   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index integration_jobs_ready_idx on public.integration_jobs (kind, run_after) where status = 'queued';
create trigger integration_jobs_updated_at before update on public.integration_jobs
  for each row execute function public.gc_set_updated_at();

create table public.notifications (
  id                    bigint generated always as identity primary key,
  order_id              uuid references public.orders (id) on delete cascade,
  customer_id           uuid references public.customers (id) on delete cascade,
  channel               public.notification_channel not null default 'email',
  template              text not null,
  payload               jsonb not null default '{}'::jsonb,   -- sem dados sensíveis
  dedupe_key            text unique,     -- ex.: 'lembrete_contrato:<order>:1'
  status                public.queue_status not null default 'queued',
  scheduled_for         timestamptz not null default now(),
  attempts              smallint not null default 0,
  sent_at               timestamptz,
  provider_message_id   text,
  last_error            text,
  created_at            timestamptz not null default now()
);
create index notifications_ready_idx on public.notifications (scheduled_for) where status = 'queued';

-- -----------------------------------------------------------------------------
-- Atendimento, auditoria e LGPD
-- -----------------------------------------------------------------------------
create table public.support_notes (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid references public.orders (id) on delete cascade,
  customer_id  uuid references public.customers (id) on delete cascade,
  staff_id     uuid not null references public.staff (id),
  channel      text not null default 'whatsapp',
  note         text not null,
  created_at   timestamptz not null default now()
);

create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid,                -- staff.id (null = sistema)
  action      text not null,       -- ex.: reveal_cpf, order_status_change, plan_price_change
  entity      text not null,
  entity_id   text,
  metadata    jsonb not null default '{}'::jsonb,
  ip          inet,
  created_at  timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);
create trigger audit_log_append_only before update or delete on public.audit_log
  for each row execute function public.gc_block_mutation();

create table public.data_requests (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers (id) on delete cascade,
  type         public.data_request_type not null,
  status       text not null default 'open' check (status in ('open', 'in_progress', 'done', 'rejected')),
  handled_by   uuid references public.staff (id),
  notes        text,
  created_at   timestamptz not null default now(),
  done_at      timestamptz
);

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.staff             enable row level security;
alter table public.plan_categories   enable row level security;
alter table public.plans             enable row level security;
alter table public.customers         enable row level security;
alter table public.consents          enable row level security;
alter table public.orders            enable row level security;
alter table public.order_events      enable row level security;
alter table public.subscriptions     enable row level security;
alter table public.payments          enable row level security;
alter table public.identity_checks   enable row level security;
alter table public.identity_files    enable row level security;
alter table public.contracts         enable row level security;
alter table public.device_info       enable row level security;
alter table public.lines             enable row level security;
alter table public.webhook_events    enable row level security;
alter table public.integration_jobs  enable row level security;
alter table public.notifications     enable row level security;
alter table public.support_notes     enable row level security;
alter table public.audit_log         enable row level security;
alter table public.data_requests     enable row level security;

-- Catálogo: público lê planos ativos
create policy plans_public_read on public.plans
  for select to anon, authenticated using (is_active);
create policy plan_categories_public_read on public.plan_categories
  for select to anon, authenticated using (is_active);

-- Equipe: cada um vê o próprio registro; owner/admin veem todos
create policy staff_self_read on public.staff
  for select to authenticated
  using (auth_user_id = auth.uid() or public.gc_is_staff(array['owner', 'admin']::public.staff_role[]));

-- Cliente: lê o próprio cadastro e os próprios pedidos (campos sensíveis vêm
-- cifrados — a interface do cliente usa views/rotas do servidor, não estas colunas)
create policy customers_self_read on public.customers
  for select to authenticated using (auth_user_id = auth.uid());

create policy orders_owner_read on public.orders
  for select to authenticated
  using (customer_id in (select id from public.customers where auth_user_id = auth.uid()));

create policy payments_owner_read on public.payments
  for select to authenticated
  using (order_id in (
    select o.id from public.orders o join public.customers c on c.id = o.customer_id
    where c.auth_user_id = auth.uid()));

-- Demais tabelas: SEM políticas para anon/authenticated → nenhum acesso pelo navegador.
-- Todo acesso passa pelo servidor (service_role), que checa a função do usuário e audita.

-- Garantia extra: anon/authenticated não escrevem em nada diretamente.
revoke insert, update, delete on all tables in schema public from anon, authenticated;

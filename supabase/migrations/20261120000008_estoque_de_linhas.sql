-- =============================================================================
-- Estoque de linhas (D26): substitui a planilha de controle.
-- Uma linha nasce "disponível" (número da conta Vivo Gestão + plano PJ) e, na ativação,
-- recebe o cliente (pedido), ICCID, Smart-Dados, data, preço de venda, valor do gestor e vencimento.
-- =============================================================================
alter type public.line_status add value if not exists 'disponivel' before 'ativa';

alter table public.lines
  alter column order_id drop not null,
  alter column activated_by drop not null,
  alter column activated_at drop not null,
  alter column activated_at drop default,
  alter column status drop default,
  add column if not exists vivo_login text,              -- "Loguin Vivo Gestão"
  add column if not exists plano_pj text,                -- "Plano PJ" (plano da Vivo Empresas)
  add column if not exists iccid text,                   -- "ICCID Atual" (digitado na ativação)
  add column if not exists smart_dados text,             -- "Smart-Dados" (ex.: Franquia de 100+100GB)
  add column if not exists sale_price_cents int,         -- "Venda Final"
  add column if not exists cost_cents int,               -- "Valor" (pago ao gestor)
  add column if not exists payment_method text,          -- "Forma de Pagamento"
  add column if not exists legacy_customer_name text,    -- clientes da planilha antiga (sem pedido no site)
  add column if not exists legacy_due_date date;         -- vencimento dos clientes antigos

-- Configurações editáveis no painel (ex.: valor pago ao gestor por linha)
create table public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_by  uuid references public.staff (id),
  updated_at  timestamptz not null default now()
);
insert into public.app_settings (key, value) values ('custo_linha_gestor_cents', '3000')
  on conflict (key) do nothing;

alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;

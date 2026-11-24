-- Watch TV junto com a linha (D44): oferta opcional de R$ 50/mês, IPTV legalizado, até 4 TVs.
-- Uma cobrança só: a assinatura do Asaas leva linha + Watch TV. Cancelar só a TV diminui o valor
-- da assinatura. A liberação é MANUAL (o dono gera o acesso no sistema da Watch com o e-mail do
-- cliente) e é registrada no painel.
--   watch_tv_cents  — preço da Watch TV no momento da compra (null = não levou)
--   watch_tv_status — pendente (falta liberar) · ativo (liberado) · cancelado
alter table public.orders
  add column watch_tv_cents int check (watch_tv_cents is null or watch_tv_cents > 0),
  add column watch_tv_status text check (watch_tv_status in ('pendente', 'ativo', 'cancelado')),
  add column watch_tv_activated_at timestamptz,
  add column watch_tv_cancelled_at timestamptz,
  add constraint watch_tv_coerente check ((watch_tv_cents is null) = (watch_tv_status is null)),
  add constraint watch_tv_ativo_tem_data check (watch_tv_status is distinct from 'ativo' or watch_tv_activated_at is not null),
  add constraint watch_tv_cancelado_tem_data check (watch_tv_status is distinct from 'cancelado' or watch_tv_cancelled_at is not null);

create index orders_watch_tv_pendente_idx on public.orders (created_at) where watch_tv_status = 'pendente';

-- Histórico: mudanças da Watch TV também aparecem no pedido (order_events)
create or replace function public.gc_orders_watch_tv_history() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.watch_tv_status is distinct from old.watch_tv_status then
    insert into public.order_events (order_id, field, from_value, to_value, actor_type, actor_id, reason)
    values (new.id, 'watch_tv_status', old.watch_tv_status, new.watch_tv_status,
            coalesce(nullif(current_setting('gc.actor_type', true), ''), 'system')::public.actor_type,
            nullif(current_setting('gc.actor_id', true), '')::uuid,
            nullif(current_setting('gc.reason', true), ''));
  end if;
  return new;
end $$;
create trigger orders_watch_tv_history after update of watch_tv_status on public.orders
  for each row execute function public.gc_orders_watch_tv_history();

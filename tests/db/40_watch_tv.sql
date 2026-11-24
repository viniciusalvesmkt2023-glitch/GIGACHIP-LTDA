-- Watch TV junto com a linha (migração 0016): preço e situação andam juntos; histórico no pedido.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d1', 'cliente-d@teste.local');
insert into public.customers (id, auth_user_id, full_name, cpf_encrypted, cpf_hash, cpf_last_digits, birth_date, email, phone_e164) values
  ('10000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d1', 'Cliente D', '\x00', 'hash-d', '35', '1990-01-01', 'd@teste.local', '+5588999990004');
insert into public.orders (id, customer_id, plan_id, plan_snapshot, monthly_price_cents, sim_type, status, watch_tv_cents, watch_tv_status)
select '20000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-0000000000d1', id, to_jsonb(p), monthly_price_cents, 'esim', 'aguardando_pagamento', 5000, 'pendente'
from public.plans p where slug = 'vivo-300gb';

do $$
begin
  -- preço sem situação (ou o contrário): recusado
  begin
    update public.orders set watch_tv_status = null where id = '20000000-0000-0000-0000-0000000000d1';
    raise exception 'deveria recusar Watch TV com preço e sem situação';
  exception when check_violation then null;
  end;

  -- "ativo" sem a data da liberação: recusado
  begin
    update public.orders set watch_tv_status = 'ativo' where id = '20000000-0000-0000-0000-0000000000d1';
    raise exception 'deveria recusar Watch TV ativa sem data';
  exception when check_violation then null;
  end;

  -- situação desconhecida: recusada
  begin
    update public.orders set watch_tv_status = 'talvez' where id = '20000000-0000-0000-0000-0000000000d1';
    raise exception 'deveria recusar situação desconhecida';
  exception when check_violation then null;
  end;

  -- liberar com data: aceito e vai para o histórico
  update public.orders set watch_tv_status = 'ativo', watch_tv_activated_at = now()
  where id = '20000000-0000-0000-0000-0000000000d1';
  if not exists (select 1 from public.order_events where order_id = '20000000-0000-0000-0000-0000000000d1'
                 and field = 'watch_tv_status' and from_value = 'pendente' and to_value = 'ativo') then
    raise exception 'liberação da Watch TV deveria ir para o histórico';
  end if;
end $$;

rollback;
\echo 'OK: regras da Watch TV passaram'

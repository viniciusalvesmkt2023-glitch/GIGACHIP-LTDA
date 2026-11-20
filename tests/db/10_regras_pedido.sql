-- Testes das regras do banco. Qualquer falha aborta com erro.
\set ON_ERROR_STOP on
begin;

-- dados de apoio
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'cliente-a@teste.local'),
  ('00000000-0000-0000-0000-000000000002', 'cliente-b@teste.local'),
  ('00000000-0000-0000-0000-000000000003', 'ativador@teste.local');
insert into public.staff (auth_user_id, name, role) values
  ('00000000-0000-0000-0000-000000000003', 'Ativador', 'ativador');
insert into public.customers (id, auth_user_id, full_name, cpf_encrypted, cpf_hash, cpf_last_digits, birth_date, email, phone_e164) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000001', 'Cliente A', '\x00', 'hash-a', '25', '1990-01-01', 'a@teste.local', '+5588999990001'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000002', 'Cliente B', '\x00', 'hash-b', '26', '1990-01-01', 'b@teste.local', '+5588999990002');
insert into public.orders (id, customer_id, plan_id, plan_snapshot, monthly_price_cents, sim_type, status)
select '20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', id, to_jsonb(p), monthly_price_cents, 'esim', 'aguardando_pagamento'
from public.plans p where slug = 'vivo-300gb';

do $$
declare o public.orders;
begin
  select * into o from public.orders where id = '20000000-0000-0000-0000-00000000000a';
  assert o.code ~ '^GC-\d{4}-\d{5}$', 'código do pedido no formato GC-AAAA-NNNNN';

  -- pagamento confirmado → em_andamento
  perform set_config('gc.actor_type', 'webhook', true);
  update public.orders set payment_status = 'confirmed' where id = o.id returning * into o;
  assert o.status = 'em_andamento', 'pago deve ir para em_andamento, veio ' || o.status;
  assert o.paid_at is not null, 'paid_at preenchido';

  -- checklist parcial não fica pronto
  perform set_config('gc.actor_type', 'system', true);
  update public.orders set identity_status = 'approved', contract_status = 'signed' where id = o.id returning * into o;
  assert o.status = 'em_andamento', 'sem aparelho não pode ficar pronto';

  -- checklist completo → pronto
  update public.orders set device_status = 'confirmed' where id = o.id returning * into o;
  assert o.status = 'pronto_para_ativacao', 'checklist completo deve ficar pronto, veio ' || o.status;
  assert o.ready_at is not null, 'ready_at preenchido';

  -- histórico gravado
  assert (select count(*) from public.order_events where order_id = o.id and field = 'status') = 2,
    'duas mudanças de status registradas';
  assert exists (select 1 from public.order_events where order_id = o.id and field = 'payment_status' and actor_type = 'webhook'),
    'ator do pagamento registrado como webhook';

  -- em_ativacao exige responsável
  begin
    update public.orders set status = 'em_ativacao' where id = o.id;
    raise exception 'deveria falhar sem assigned_to';
  exception when check_violation then null;
  end;

  -- estorno antes da ativação → pendência
  update public.orders set payment_status = 'refunded' where id = o.id returning * into o;
  assert o.status = 'pendencia' and o.problem_reason = 'pagamento_estornado', 'estorno vira pendência';
end $$;

-- histórico e auditoria são somente inserção
do $$ begin
  begin
    delete from public.order_events;
    raise exception 'order_events não pode ser apagado';
  exception when raise_exception then
    if sqlerrm not like '%somente inserção%' then raise; end if;
  end;
  insert into public.audit_log (action, entity) values ('teste', 'teste');
  begin
    update public.audit_log set action = 'x';
    raise exception 'audit_log não pode ser alterado';
  exception when raise_exception then
    if sqlerrm not like '%somente inserção%' then raise; end if;
  end;
end $$;

-- webhook duplicado é ignorado pela chave única
insert into public.webhook_events (provider, event_id, event_type, payload) values ('asaas', 'evt_1', 'PAYMENT_RECEIVED', '{}');
insert into public.webhook_events (provider, event_id, event_type, payload) values ('asaas', 'evt_1', 'PAYMENT_RECEIVED', '{}')
  on conflict (provider, event_id) do nothing;
do $$ begin
  assert (select count(*) from public.webhook_events where event_id = 'evt_1') = 1, 'webhook duplicado deduplicado';
end $$;

-- no máximo uma primeira cobrança pendente por pedido
insert into public.payments (order_id, provider_payment_id, billing_type, amount_cents, due_date, is_first_payment)
values ('20000000-0000-0000-0000-00000000000a', 'pay_1', 'pix', 14999, current_date, true);
do $$ begin
  begin
    insert into public.payments (order_id, provider_payment_id, billing_type, amount_cents, due_date, is_first_payment)
    values ('20000000-0000-0000-0000-00000000000a', 'pay_2', 'pix', 14999, current_date, true);
    raise exception 'cobrança duplicada deveria falhar';
  exception when unique_violation then null;
  end;
end $$;

-- RLS: cliente B não vê o pedido do cliente A; anônimo vê só planos
set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true); end $$;
do $$ begin
  assert (select count(*) from public.orders) = 0, 'cliente B não pode ver pedido de A';
  assert (select count(*) from public.customers) = 1, 'cliente B vê só o próprio cadastro';
  assert (select count(*) from public.device_info) = 0, 'device_info inacessível';
end $$;
do $$ begin perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true); end $$;
do $$ begin
  assert (select count(*) from public.orders) = 1, 'cliente A vê o próprio pedido';
  assert (select count(*) from public.payments) = 1, 'cliente A vê a própria cobrança';
  begin
    update public.orders set status = 'ativado';
    raise exception 'cliente não pode alterar pedido';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set local role anon;
do $$ begin
  assert (select count(*) from public.plans) = 3, 'anônimo vê os 3 planos ativos';
  assert (select count(*) from public.customers) = 0, 'anônimo não vê clientes';
end $$;
reset role;

rollback;
\echo 'OK: todas as regras do banco passaram'

-- Inadimplência (D29): um bloqueio aberto por cliente do Asaas; tabelas fechadas para o navegador.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d1', 'dono@teste.local');
insert into public.staff (id, auth_user_id, name, role) values
  ('30000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d1', 'Dono', 'owner');

insert into public.overdue_payments (provider_payment_id, provider_customer_id, customer_name, value_cents, due_date)
values ('pay_1', 'cus_1', 'Cliente Antigo', 12499, '2026-11-20');

do $$ begin
  insert into public.line_blocks (provider_customer_id, customer_name, blocked_by)
  values ('cus_1', 'Cliente Antigo', '30000000-0000-0000-0000-0000000000d1');
  begin
    insert into public.line_blocks (provider_customer_id, customer_name, blocked_by)
    values ('cus_1', 'Cliente Antigo', '30000000-0000-0000-0000-0000000000d1');
    raise exception 'não pode haver dois bloqueios abertos para o mesmo cliente';
  exception when unique_violation then null;
  end;
  -- desbloqueio exige quem desbloqueou
  begin
    update public.line_blocks set unblocked_at = now() where provider_customer_id = 'cus_1';
    raise exception 'desbloqueio sem responsável deveria falhar';
  exception when check_violation then null;
  end;
  update public.line_blocks set unblocked_at = now(), unblocked_by = '30000000-0000-0000-0000-0000000000d1' where provider_customer_id = 'cus_1';
  -- depois de desbloquear, pode bloquear de novo (próximo atraso)
  insert into public.line_blocks (provider_customer_id, customer_name, blocked_by)
  values ('cus_1', 'Cliente Antigo', '30000000-0000-0000-0000-0000000000d1');
end $$;

set local role anon;
do $$ begin
  assert (select count(*) from public.overdue_payments) = 0, 'anônimo não vê inadimplência';
  assert (select count(*) from public.line_blocks) = 0, 'anônimo não vê bloqueios';
end $$;
reset role;

rollback;
\echo 'OK: regras de inadimplência passaram'

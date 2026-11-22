-- Dados do aparelho/chip (migração 0015): chip físico só com ICCID; nunca sem identificador.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c1', 'cliente-c@teste.local');
insert into public.customers (id, auth_user_id, full_name, cpf_encrypted, cpf_hash, cpf_last_digits, birth_date, email, phone_e164) values
  ('10000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c1', 'Cliente C', '\x00', 'hash-c', '27', '1990-01-01', 'c@teste.local', '+5588999990003');
insert into public.orders (id, customer_id, plan_id, plan_snapshot, monthly_price_cents, sim_type, status)
select '20000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-0000000000c1', id, to_jsonb(p), monthly_price_cents, 'physical', 'aguardando_pagamento'
from public.plans p where slug = 'vivo-300gb';

do $$
begin
  -- chip físico: só ICCID + foto da embalagem
  insert into public.device_info (order_id, iccid_encrypted, image_kind)
  values ('20000000-0000-0000-0000-0000000000c1', '\x01', 'foto_embalagem');

  -- sem IMEI e sem ICCID: recusado
  begin
    update public.device_info set iccid_encrypted = null where order_id = '20000000-0000-0000-0000-0000000000c1';
    raise exception 'deveria recusar aparelho sem IMEI e sem ICCID';
  exception when check_violation then null;
  end;

  -- tipo de imagem desconhecido: recusado
  begin
    update public.device_info set image_kind = 'outra' where order_id = '20000000-0000-0000-0000-0000000000c1';
    raise exception 'deveria recusar image_kind desconhecido';
  exception when check_violation then null;
  end;
end $$;

rollback;
\echo 'OK: regras do aparelho/chip passaram'

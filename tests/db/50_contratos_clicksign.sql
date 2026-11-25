-- Contratos pela Clicksign (migração 0017): etapas e formas de identificação novas.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'cliente-e@teste.local');
insert into public.customers (id, auth_user_id, full_name, cpf_encrypted, cpf_hash, cpf_last_digits, birth_date, email, phone_e164) values
  ('10000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e1', 'Cliente E', '\x00', 'hash-e', '44', '1990-01-01', 'e@teste.local', '+5588999990005');
insert into public.orders (id, customer_id, plan_id, plan_snapshot, monthly_price_cents, sim_type, status)
select '20000000-0000-0000-0000-0000000000e1', '10000000-0000-0000-0000-0000000000e1', id, to_jsonb(p), monthly_price_cents, 'esim', 'aguardando_pagamento'
from public.plans p where slug = 'vivo-300gb';
insert into public.contracts (id, order_id, provider, template_version, status, step)
values ('30000000-0000-0000-0000-0000000000e1', '20000000-0000-0000-0000-0000000000e1', 'clicksign', 'v6', 'queued', 'gerar_pdf');

do $$
begin
  -- etapas da Clicksign: aceitas
  update public.contracts set step = 'enviar_documento', provider_envelope_id = 'env-1' where id = '30000000-0000-0000-0000-0000000000e1';
  update public.contracts set step = 'requisitos', provider_signer_id = 'sig-1' where id = '30000000-0000-0000-0000-0000000000e1';
  update public.contracts set step = 'ativar', signer_auth = 'facial_biometrics' where id = '30000000-0000-0000-0000-0000000000e1';
  update public.contracts set signer_auth = 'selfie_documento' where id = '30000000-0000-0000-0000-0000000000e1';

  -- etapa desconhecida: recusada
  begin
    update public.contracts set step = 'qualquer' where id = '30000000-0000-0000-0000-0000000000e1';
    raise exception 'deveria recusar etapa desconhecida';
  exception when check_violation then null;
  end;

  -- forma de identificação desconhecida: recusada
  begin
    update public.contracts set signer_auth = 'pix' where id = '30000000-0000-0000-0000-0000000000e1';
    raise exception 'deveria recusar signer_auth desconhecido';
  exception when check_violation then null;
  end;
end $$;

rollback;
\echo 'OK: regras dos contratos da Clicksign passaram'

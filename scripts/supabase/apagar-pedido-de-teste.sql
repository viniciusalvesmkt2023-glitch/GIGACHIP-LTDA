-- =============================================================================
-- APAGA UM PEDIDO DE TESTE (e o cliente dele, se não tiver outro pedido).
-- Troque o número na linha "numero" abaixo (ex.: 1 = pedido #1) e rode tudo no SQL Editor.
-- - Se o pedido tinha um número de linha, o número volta para o estoque (Disponível).
-- - Se não sobrar nenhum pedido, a numeração volta a começar do #1.
-- - O histórico de auditoria (audit_log) é mantido.
-- =============================================================================
do $$
declare
  numero int := 1;   -- <<< número do pedido de teste
  v_order uuid;
  v_customer uuid;
begin
  select id, customer_id into v_order, v_customer from public.orders
  where ltrim(split_part(code, '-', 3), '0') = numero::text;
  if v_order is null then
    raise exception 'Pedido #% não encontrado.', numero;
  end if;

  -- número da linha volta para o estoque
  update public.lines
  set status = 'disponivel', order_id = null, legacy_customer_name = null, iccid = null, smart_dados = null,
      activated_at = null, sale_price_cents = null, cost_cents = null, legacy_due_date = null,
      asaas_customer_id = null, sheet_pending = false, sheet_error = null, sheet_overwrite = false
  where order_id = v_order;

  delete from public.contracts where order_id = v_order;
  delete from public.payments where order_id = v_order;
  delete from public.subscriptions where order_id = v_order;

  -- o histórico do pedido só aceita inserção: libera só durante esta limpeza
  alter table public.order_events disable trigger order_events_append_only;
  delete from public.orders where id = v_order;
  alter table public.order_events enable trigger order_events_append_only;

  if not exists (select 1 from public.orders where customer_id = v_customer) then
    delete from public.customers where id = v_customer;
  end if;

  if not exists (select 1 from public.orders) then
    alter sequence public.order_code_seq restart with 1;
  end if;

  raise notice 'Pedido #% apagado.', numero;
end $$;

-- Conferência
select (select count(*) from public.orders) as pedidos_restantes,
       (select count(*) from public.lines where status = 'disponivel') as numeros_disponiveis;

-- =============================================================================
-- LIMPEZA DOS DADOS DE TESTE — rodar UMA VEZ, no dia do lançamento (docs/08-lancamento.md).
--
-- APAGA: clientes, pedidos, pagamentos, contratos, prints, linhas, inadimplência, e-mails da fila,
--        avisos recebidos (webhooks) e tentativas de login. A numeração dos pedidos volta para
--        GC-AAAA-00001.
-- MANTÉM: equipe (logins e 2FA), planos, valor do gestor e o histórico de auditoria (audit_log).
-- As linhas voltam na hora em que você clicar em "Ler planilha agora" (com a planilha verdadeira).
--
-- Trava de segurança: só roda se a primeira linha abaixo estiver presente e correta.
-- =============================================================================
set gigachip.confirmar = 'APAGAR-DADOS-DE-TESTE';

do $$
begin
  if current_setting('gigachip.confirmar', true) is distinct from 'APAGAR-DADOS-DE-TESTE' then
    raise exception 'Confirmação ausente: leia o roteiro de lançamento antes de rodar.';
  end if;
end $$;

begin;
truncate table
  public.customers, public.consents, public.orders, public.order_events, public.subscriptions, public.payments,
  public.identity_checks, public.identity_files, public.identity_file_blobs, public.contracts, public.contract_files,
  public.device_info, public.device_screenshots, public.lines, public.line_blocks, public.overdue_payments,
  public.webhook_events, public.integration_jobs, public.notifications, public.support_notes, public.data_requests,
  public.order_access_tokens, public.api_call_log, public.staff_login_attempts, public.staff_password_resets
  restart identity cascade;

alter sequence public.order_code_seq restart with 1;

-- Leituras automáticas recomeçam do zero (o link da planilha verdadeira é colocado em Configurações)
delete from public.app_settings where key in ('planilha_lida_em', 'inadimplencia_sincronizada_em', 'planilha_google');
commit;

-- Conferência: tudo deve dar 0
select (select count(*) from public.orders) as pedidos, (select count(*) from public.customers) as clientes,
       (select count(*) from public.lines) as linhas, (select count(*) from public.staff) as equipe_mantida;

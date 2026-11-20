-- =============================================================================
-- Rotina a cada 10 minutos (Supabase pg_cron + pg_net) — rodar UMA VEZ no SQL Editor.
-- Chama /api/cron/rotinas, que: envia contratos que ficaram na fila (ex.: limite da D4Sign),
-- confere assinaturas pendentes e envia e-mails da fila.
--
-- ANTES DE RODAR: troque COLE_AQUI_O_CRON_SECRET pelo mesmo valor da variável CRON_SECRET da Vercel.
-- (Não salve este arquivo com o valor real no GitHub.)
-- =============================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Remove a versão anterior, se existir (pode rodar de novo sem duplicar)
select cron.unschedule(jobid) from cron.job where jobname = 'gigachip-rotinas';

select cron.schedule(
  'gigachip-rotinas',
  '*/10 * * * *',
  $$
  select net.http_get(
    url := 'https://gigachip-ltda.vercel.app/api/cron/rotinas',
    headers := jsonb_build_object('Authorization', 'Bearer COLE_AQUI_O_CRON_SECRET'),
    timeout_milliseconds := 60000
  );
  $$
);

-- Conferir: deve aparecer 1 linha
select jobid, jobname, schedule, active from cron.job where jobname = 'gigachip-rotinas';

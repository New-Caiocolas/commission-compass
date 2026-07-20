-- Agendamento diário da sincronização financeira Senior XT via pg_cron + pg_net.
-- O cron.schedule() abaixo fica comentado de propósito: só deve ser executado
-- depois que a Edge Function `sync-senior-financeiro` estiver deployada e o
-- secret SUPABASE_SERVICE_ROLE_KEY/URL da function forem conhecidos.
--
-- Passo a passo para ativar (rodar manualmente no SQL editor do Supabase,
-- não faz parte desta migration para não versionar a service role key):
--
-- 1) supabase functions deploy sync-senior-financeiro
-- 2) select cron.schedule(
--      'sync-senior-financeiro-diario',
--      '0 6 * * *',
--      $$
--        select net.http_post(
--          url := 'https://<project-ref>.supabase.co/functions/v1/sync-senior-financeiro',
--          headers := jsonb_build_object(
--            'Content-Type', 'application/json',
--            'Authorization', 'Bearer <SUPABASE_SERVICE_ROLE_KEY>'
--          ),
--          body := '{}'::jsonb
--        );
--      $$
--    );
--
-- Para checar execuções: select * from cron.job_run_details order by start_time desc limit 10;
-- Para remover: select cron.unschedule('sync-senior-financeiro-diario');

-- pg_cron não é relocável (precisa do schema padrão dele); pg_net vai em extensions.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

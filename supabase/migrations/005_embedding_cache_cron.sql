-- Schedule periodic cleanup of expired embedding cache entries using pg_cron
-- On Supabase: enable "pg_cron" in Database → Extensions if not already enabled.
-- To remove the job later: SELECT cron.unschedule('delete-expired-embedding-cache');

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Run every hour at minute 0; remove expired rows from embedding_cache
SELECT cron.schedule(
  'delete-expired-embedding-cache',
  '*/6 * * * *',
  $$SELECT delete_expired_embedding_cache()$$
);

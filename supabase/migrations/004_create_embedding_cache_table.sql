-- Embedding cache using PostgreSQL hstore: key-value store for cache_key -> { embedding, expires_at }
-- Enable hstore extension (key/value pairs, both text)
CREATE EXTENSION IF NOT EXISTS hstore;

-- Drop existing table if it used the previous schema (vector column)
DROP TABLE IF EXISTS embedding_cache;

-- Cache table: cache_key (e.g. normalized ingredients) -> hstore payload with 'embedding' (JSON array string) and 'expires_at' (ISO timestamp)
CREATE TABLE embedding_cache (
  cache_key text PRIMARY KEY,
  payload hstore NOT NULL
);

-- Index for efficient cleanup of expired rows (expression on hstore key)
CREATE INDEX embedding_cache_expires_at_idx ON embedding_cache (((payload->'expires_at')::timestamptz));

COMMENT ON TABLE embedding_cache IS 'Cache of query embeddings keyed by normalized ingredients; payload is hstore with embedding (JSON array) and expires_at (timestamptz as text).';

-- Get cached embedding by key; returns the embedding as JSON text or null if missing/expired
CREATE OR REPLACE FUNCTION get_embedding_cache(p_key text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT payload->'embedding'
  FROM embedding_cache
  WHERE cache_key = p_key
    AND (payload->'expires_at')::timestamptz > now();
$$;

-- Set or overwrite cached embedding
CREATE OR REPLACE FUNCTION set_embedding_cache(
  p_key text,
  p_embedding_json text,
  p_expires_at timestamptz
)
RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO embedding_cache (cache_key, payload)
  VALUES (p_key, hstore(ARRAY['embedding', 'expires_at'], ARRAY[p_embedding_json, p_expires_at::text]))
  ON CONFLICT (cache_key) DO UPDATE
  SET payload = hstore(ARRAY['embedding', 'expires_at'], ARRAY[p_embedding_json, p_expires_at::text]);
$$;

-- Delete expired entries; returns count of deleted rows
CREATE OR REPLACE FUNCTION delete_expired_embedding_cache()
RETURNS int
LANGUAGE sql
AS $$
  WITH deleted AS (
    DELETE FROM embedding_cache
    WHERE (payload->'expires_at')::timestamptz < now()
    RETURNING cache_key
  )
  SELECT count(*)::int FROM deleted;
$$;

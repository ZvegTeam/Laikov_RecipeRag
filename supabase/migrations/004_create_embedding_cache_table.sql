-- Embedding cache: key -> embedding (hstore) + expires_at (column for indexable, immutable lookups)
CREATE EXTENSION IF NOT EXISTS hstore;

DROP TABLE IF EXISTS embedding_cache;

CREATE TABLE embedding_cache (
  cache_key text PRIMARY KEY,
  payload hstore NOT NULL,
  expires_at timestamptz NOT NULL
);

-- Index for efficient cleanup of expired rows (plain column is immutable)
CREATE INDEX embedding_cache_expires_at_idx ON embedding_cache (expires_at);

COMMENT ON TABLE embedding_cache IS 'Cache of query embeddings keyed by normalized ingredients; payload.embedding = JSON array, expires_at for TTL.';

CREATE OR REPLACE FUNCTION get_embedding_cache(p_key text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT payload->'embedding'
  FROM embedding_cache
  WHERE cache_key = p_key
    AND expires_at > now();
$$;

CREATE OR REPLACE FUNCTION set_embedding_cache(
  p_key text,
  p_embedding_json text,
  p_expires_at timestamptz
)
RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO embedding_cache (cache_key, payload, expires_at)
  VALUES (p_key, hstore('embedding', p_embedding_json), p_expires_at)
  ON CONFLICT (cache_key) DO UPDATE
  SET payload = hstore('embedding', p_embedding_json), expires_at = p_expires_at;
$$;

CREATE OR REPLACE FUNCTION delete_expired_embedding_cache()
RETURNS int
LANGUAGE sql
AS $$
  WITH deleted AS (
    DELETE FROM embedding_cache
    WHERE expires_at < now()
    RETURNING cache_key
  )
  SELECT count(*)::int FROM deleted;
$$;

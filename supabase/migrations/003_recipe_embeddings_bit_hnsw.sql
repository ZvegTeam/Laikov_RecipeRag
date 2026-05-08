-- Recipe embeddings: binary quantized bit(384) with HNSW for similarity search
-- Split from recipes for best compression and separate indexing
CREATE TABLE IF NOT EXISTS recipe_embeddings (
  recipe_id UUID PRIMARY KEY REFERENCES recipes(id) ON DELETE CASCADE,
  embedding bit(384) NOT NULL
);

-- HNSW index for approximate nearest neighbor by Hamming distance
CREATE INDEX IF NOT EXISTS recipe_embeddings_embedding_idx ON recipe_embeddings
USING hnsw (embedding bit_hamming_ops)
WITH (m = 16, ef_construction = 64);

COMMENT ON TABLE recipe_embeddings IS 'Binary quantized (sign) embeddings bit(384) for recipes; HNSW index for fast Hamming similarity search.';

-- Create recipes table with vector column for embeddings
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_id TEXT UNIQUE,
  name TEXT NOT NULL,
  ingredients TEXT NOT NULL,
  description TEXT,
  url TEXT,
  image TEXT,
  cook_time TEXT,
  prep_time TEXT,
  recipe_yield TEXT,
  date_published DATE,
  source TEXT,
  embedding vector(768), -- Gemini embedding dimension (verify actual dimension)
  cooking_instructions TEXT, -- Detailed cooking process
  additional_info JSONB, -- Additional recipe info (tips, variations, etc.)
  instructions_fetched_at TIMESTAMP, -- When instructions were last fetched
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for vector similarity search using IVFFlat
-- Note: IVFFlat requires at least some data before creating index
-- Consider creating index after initial data load, or use HNSW for better accuracy
CREATE INDEX IF NOT EXISTS recipes_embedding_idx ON recipes 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index on original_id for faster lookups
CREATE INDEX IF NOT EXISTS recipes_original_id_idx ON recipes (original_id);

-- Create index on name for text search
CREATE INDEX IF NOT EXISTS recipes_name_idx ON recipes USING gin (to_tsvector('english', name));

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_recipes_updated_at
  BEFORE UPDATE ON recipes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


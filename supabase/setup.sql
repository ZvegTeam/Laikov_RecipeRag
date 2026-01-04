-- Complete Supabase setup script
-- Run this in the Supabase SQL Editor to set up everything at once

-- Step 1: Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Create recipes table
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
  embedding vector(384), -- Local transformer embedding dimension (Xenova/all-MiniLM-L6-v2)
  cooking_instructions TEXT, -- Detailed cooking process
  additional_info JSONB, -- Additional recipe info (tips, variations, etc.)
  instructions_fetched_at TIMESTAMP, -- When instructions were last fetched
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Step 3: Create indexes
-- Note: IVFFlat index may fail if table is empty. Create after loading some data.
-- For now, we'll create it but you may need to recreate it after data load.

-- Vector similarity search index (create after some data is loaded)
-- CREATE INDEX IF NOT EXISTS recipes_embedding_idx ON recipes 
-- USING ivfflat (embedding vector_cosine_ops)
-- WITH (lists = 100);

-- Alternative: Use HNSW for better accuracy (works with empty table)
CREATE INDEX IF NOT EXISTS recipes_embedding_idx ON recipes 
USING hnsw (embedding vector_cosine_ops);

-- Other indexes
CREATE INDEX IF NOT EXISTS recipes_original_id_idx ON recipes (original_id);
CREATE INDEX IF NOT EXISTS recipes_name_idx ON recipes USING gin (to_tsvector('english', name));

-- Step 4: Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger
CREATE TRIGGER update_recipes_updated_at
  BEFORE UPDATE ON recipes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 6: Create search function for vector similarity search
CREATE OR REPLACE FUNCTION search_recipes_by_embedding(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  original_id text,
  name text,
  ingredients text,
  description text,
  url text,
  image text,
  cook_time text,
  prep_time text,
  recipe_yield text,
  date_published date,
  source text,
  cooking_instructions text,
  additional_info jsonb,
  instructions_fetched_at timestamp,
  created_at timestamp,
  updated_at timestamp,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.original_id,
    r.name,
    r.ingredients,
    r.description,
    r.url,
    r.image,
    r.cook_time,
    r.prep_time,
    r.recipe_yield,
    r.date_published,
    r.source,
    r.cooking_instructions,
    r.additional_info,
    r.instructions_fetched_at,
    r.created_at,
    r.updated_at,
    1 - (r.embedding <=> query_embedding) AS similarity
  FROM recipes r
  WHERE r.embedding IS NOT NULL
    AND 1 - (r.embedding <=> query_embedding) >= match_threshold
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Verification queries (uncomment to run)
-- SELECT * FROM pg_extension WHERE extname = 'vector';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'recipes';


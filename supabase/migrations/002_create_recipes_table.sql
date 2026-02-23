-- Recipes table: metadata only (no embeddings; embeddings live in recipe_embeddings)
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_id TEXT UNIQUE NOT NULL,
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
  cooking_instructions TEXT,
  additional_info JSONB,
  instructions_fetched_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS recipes_original_id_idx ON recipes (original_id);
CREATE INDEX IF NOT EXISTS recipes_name_idx ON recipes USING gin (to_tsvector('english', name));

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_recipes_updated_at
  BEFORE UPDATE ON recipes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

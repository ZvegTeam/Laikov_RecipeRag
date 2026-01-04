-- Create function for vector similarity search
-- This function searches recipes by embedding similarity using cosine distance

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

-- Grant execute permission to authenticated users (adjust as needed for your RLS policies)
-- GRANT EXECUTE ON FUNCTION search_recipes_by_embedding TO authenticated;
-- GRANT EXECUTE ON FUNCTION search_recipes_by_embedding TO anon;


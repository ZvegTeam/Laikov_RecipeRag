# Supabase Setup Instructions

This directory contains SQL migration files for setting up the Supabase database.

## Prerequisites

1. Create a Supabase project at [https://supabase.com](https://supabase.com)
2. Note down your project URL and API keys from the project settings

## Setup Steps

### 1. Enable pgvector Extension

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run the migration file: `migrations/001_enable_pgvector.sql`

Or manually run:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. Create Recipes Table

1. In the SQL Editor, run: `migrations/002_create_recipes_table.sql`

This will create:
- The `recipes` table with all required columns
- Vector similarity search index (IVFFlat)
- Indexes for performance
- Automatic `updated_at` timestamp trigger

### 3. Verify Setup

Run this query to verify the table was created:

```sql
SELECT 
  column_name, 
  data_type, 
  udt_name
FROM information_schema.columns 
WHERE table_name = 'recipes'
ORDER BY ordinal_position;
```

Check if pgvector is enabled:

```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

## Important Notes

### Vector Index

The IVFFlat index is created with `lists = 100`. This is a good starting point, but you may need to adjust based on:
- Number of recipes in your database
- Query performance requirements

**Note**: IVFFlat index requires some data before it can be effective. If you have fewer than 1000 recipes, consider:
- Reducing the `lists` parameter (e.g., `lists = 10`)
- Or using HNSW index instead for better accuracy (slower inserts)

### Embedding Dimension

The current schema uses `vector(768)` for embeddings. Verify the actual dimension of your Gemini embedding model:
- `text-embedding-004`: 768 dimensions
- `embedding-001`: 768 dimensions
- Other models may vary

Update the schema if your embedding dimension differs.

### Row Level Security (RLS)

Currently, RLS is not enabled. For production, consider adding RLS policies:

```sql
-- Enable RLS
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

-- Example: Allow public read access
CREATE POLICY "Allow public read access" ON recipes
  FOR SELECT USING (true);
```

## Migration Files

- `001_enable_pgvector.sql` - Enables the pgvector extension
- `002_create_recipes_table.sql` - Creates the recipes table and indexes

## Troubleshooting

### Index Creation Fails

If the IVFFlat index creation fails with "not enough data", you have two options:

1. **Load some data first**, then create the index
2. **Use HNSW index** instead (better for smaller datasets):

```sql
CREATE INDEX recipes_embedding_idx ON recipes 
USING hnsw (embedding vector_cosine_ops);
```

### Vector Dimension Mismatch

If you get dimension mismatch errors, check your embedding model's output dimension and update the schema:

```sql
ALTER TABLE recipes ALTER COLUMN embedding TYPE vector(1024); -- or your dimension
```


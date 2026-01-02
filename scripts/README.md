# Scripts Documentation

## parse-json.ts

Parses MongoDB-style JSON recipe file into normalized format.

### Usage

```bash
# Use default files
bun run parse:json

# Or specify custom files
bun scripts/parse-json.ts input.json output.json
```

### Output

Creates `recipes-parsed.json` with normalized recipe data.

## vectorize-data.ts

Vectorizes recipes and uploads them to Supabase. Supports both local and remote Supabase instances.

### Usage

#### Local Supabase (Recommended for Development)

1. **Start local Supabase**:
   ```bash
   bun run supabase:start
   ```

2. **Get credentials**:
   ```bash
   bun run supabase:status
   ```

3. **Set environment variables** in `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321
   SUPABASE_SERVICE_ROLE_KEY=<from supabase status>
   GEMINI_API_KEY=your_gemini_api_key
   ```

4. **Run vectorization**:
   ```bash
   # Option 1: Use dedicated script (recommended)
   bun run vectorize:local

   # Option 2: Set environment variable
   USE_LOCAL_SUPABASE=true bun scripts/vectorize-data.ts

   # Option 3: Auto-detect (if URL contains localhost or 127.0.0.1)
   bun run vectorize
   ```

#### Remote Supabase (Production)

1. **Set environment variables** in `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   GEMINI_API_KEY=your_gemini_api_key
   ```

2. **Run vectorization**:
   ```bash
   # Option 1: Use dedicated script (recommended)
   bun run vectorize:remote

   # Option 2: Set environment variable
   USE_REMOTE_SUPABASE=true bun scripts/vectorize-data.ts

   # Option 3: Auto-detect (if URL is not localhost)
   bun run vectorize
   ```

### Command Line Options

```bash
bun scripts/vectorize-data.ts [input_file] [batch_size] [embedding_batch_size] [options]
```

**Arguments:**
- `input_file` - Path to parsed recipes JSON file (default: `recipes-parsed.json`)
- `batch_size` - Number of recipes to insert per database batch (default: 100)
- `embedding_batch_size` - Number of embeddings to generate in parallel (default: 10)

**Options:**
- `--skip-embeddings` - Skip embedding generation (useful for testing or if embeddings already exist)
- `--model=<model_name>` - Gemini embedding model to use (default: `text-embedding-004`)

### Examples

```bash
# Basic usage with defaults
bun run vectorize:local

# Custom batch sizes
bun run vectorize:local recipes-parsed.json 50 5

# Skip embeddings (only upload data)
bun run vectorize:local recipes-parsed.json 100 10 --skip-embeddings

# Use different embedding model
bun run vectorize:local recipes-parsed.json 100 10 --model=embedding-001

# Upload to remote Supabase
bun run vectorize:remote recipes-parsed.json 200 20
```

### Performance Tips

1. **Embedding Batch Size**: Start with 10 and increase if you have higher rate limits. Too high may cause rate limit errors.

2. **Database Batch Size**: 100 is a good default. Increase for faster uploads, decrease if you encounter connection issues.

3. **Skip Embeddings**: Use `--skip-embeddings` if you only want to upload recipe data without embeddings (e.g., for testing).

4. **Resume Capability**: The script uses `upsert` with `original_id` as the conflict key, so you can safely re-run it if it fails partway through.

### Error Handling

- The script will continue processing even if some embeddings fail
- Failed recipes are logged but don't stop the process
- Database insert errors are logged per batch
- Final summary shows success/failure counts

### Environment Variables

Required:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `GEMINI_API_KEY` - Google Gemini API key

Optional:
- `USE_LOCAL_SUPABASE=true` - Force local Supabase mode
- `USE_REMOTE_SUPABASE=true` - Force remote Supabase mode


# Recipe Search Application

A web application that finds recipes by ingredients using vector similarity search (pgvector), local transformer embeddings, and LangChain with Gemini AI for recipe details extraction.

## Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **Next.js 14** (App Router) | React framework, server components, API routes |
| **Mantine UI** | Component library (forms, cards, modals, layout) |
| **Lucide React** | Icons |
| **React 18** | UI rendering |

### Backend & Data
| Technology | Purpose |
|------------|---------|
| **PostgreSQL** (Supabase) | Primary database |
| **Drizzle ORM** | Type-safe query builder, schema, migrations |
| **pgvector** | Vector similarity search |
| **Supabase** | Managed PostgreSQL, local dev via Supabase CLI |

### AI & Embeddings
| Technology | Purpose |
|------------|---------|
| **@xenova/transformers** | Local embedding generation (no API calls), model: `Xenova/all-MiniLM-L6-v2` (384 dimensions) |
| **LangChain** (`@langchain/core`) | Prompt templates, chains, retriever abstraction |
| **@langchain/google-genai** | Gemini integration (ChatGoogleGenerativeAI, structured output) |
| **Google Gemini** | Recipe details extraction (cooking instructions from URL or web search) |

### Vector Search Pipeline
| Component | Purpose |
|-----------|---------|
| **Binary quantization** | Float embeddings → sign bits (bit 384), reduces storage and enables Hamming distance |
| **HNSW index** | Approximate nearest neighbor search (bit_hamming_ops) |
| **Embedding cache** | In-memory + DB (hstore) cache for search query embeddings, TTL 5 min |

### Validation & Quality
| Technology | Purpose |
|------------|---------|
| **Zod** | Request/response validation, schema definitions |
| **zod-to-json-schema** | Structured output schema for Gemini |
| **Biome** | Linting, formatting, pre-commit hooks |

### Tooling
| Technology | Purpose |
|------------|---------|
| **Bun** | Package manager, script runner |
| **TypeScript** | Static typing |
| **Node-loader** | Load @xenova/transformers in Next.js |

---

## Application Flows

### 1. Recipe Search Flow

**Trigger:** User enters ingredients and submits search.

| Step | Instrument | Description |
|------|------------|-------------|
| 1 | `SearchForm` | Collects ingredients (textarea), validates, calls `POST /api/search` |
| 2 | `POST /api/search` | Validates body (Zod), delegates to `searchRecipesByQuery` |
| 3 | `searchRecipesByQuery` | Builds query text → checks embedding cache → `generateEmbedding` if miss |
| 4 | `generateEmbedding` | @xenova/transformers pipeline (all-MiniLM-L6-v2), mean pooling, normalize |
| 5 | `binaryQuantize` | Float[384] → bit string (sign quantization) |
| 6 | Drizzle + raw SQL | `SELECT ... ORDER BY embedding <~> queryBit LIMIT n`, HNSW Hamming |
| 7 | Response | Recipes with similarity scores |

**Output:** JSON with `recipes` array and `count`.

---

### 2. Recipe Details Flow

**Trigger:** User clicks "View Details" on a recipe card.

| Step | Instrument | Description |
|------|-------------|-------------|
| 1 | `RecipeDetails` | Fetches `POST /api/recipe-details` with `recipeId` or `recipeUrl` |
| 2 | `rateLimit` | 10 req/min per IP |
| 3 | `getRecipeForDetails` | Loads recipe from DB by id or url |
| 4 | Cache check | If `cooking_instructions` and `instructions_fetched_at` exist → return cached |
| 5 | `fetchAndSaveRecipeDetails` | `DefaultRecipeDetailsChain.runWithFallback(context)` |
| 6 | `RecipeDetailsChain` | PromptsService → GeminiLlmService (withStructuredOutput) |
| 7 | PromptsService | Picks prompt: URL extraction (if url) or web search; LangChain ChatPromptTemplate |
| 8 | GeminiLlmService | ChatGoogleGenerativeAI + recipeDetailsZodSchema → typed response |
| 9 | Fallback | URL extraction fails → web search prompt |
| 10 | DB update | Persist `cooking_instructions`, `additional_info`, `instructions_fetched_at` |
| 11 | Response | `cooking_instructions`, `additional_info`, `cached`, `fetched_at` |

**Output:** Cooking instructions and additional info (tips, variations, etc.).

---

### 3. RAG Chain Flow (Recipe Q&A)

**Trigger:** Programmatic use of `RecipeRagChain` (e.g. "What can I make with chicken and garlic?").

| Step | Instrument | Description |
|------|-------------|-------------|
| 1 | `RecipeRagChain.run(query)` | Retrieves docs, formats context, calls LLM |
| 2 | `RecipeRetriever` | LangChain BaseRetriever, `invoke(query)` |
| 3 | `searchRecipesByQuery` | Same pipeline as flow 1 (embed → quantize → pgvector) |
| 4 | Document conversion | Recipes → LangChain `Document[]` (pageContent, metadata) |
| 5 | `PromptsService.getStaticPrompt` | RECIPE_RAG_SYSTEM prompt from templates |
| 6 | `GeminiLlmService` | Raw text mode (no schema), generates answer |
| 7 | Response | Concise answer with recipe names when relevant |

**Output:** String answer. Used for future features (e.g. natural-language recipe discovery).

---

### 4. Data Vectorization Flow

**Trigger:** `bun run vectorize recipes-parsed.json` (offline script).

| Step | Instrument | Description |
|------|-------------|-------------|
| 1 | `parse-json.ts` | Parse MongoDB JSON → normalized ParsedRecipe |
| 2 | `vectorize-data.ts` | Batch process, skip existing recipe IDs (resume) |
| 3 | `generateEmbedding` | Per recipe: `name + ingredients + description` → float[384] |
| 4 | `binaryQuantize` | Float → bit string |
| 5 | Drizzle | Insert into `recipes` and `recipe_embeddings` |

**Output:** Populated `recipes` and `recipe_embeddings` tables.

---

### 5. Embedding Cache Flow

**Trigger:** Search queries (flow 1).

| Step | Instrument | Description |
|------|-------------|-------------|
| 1 | `embeddingCacheService.get(cacheKey)` | Check DB (hstore) for cached embedding |
| 2 | Cache hit | Return cached float[]; skip `generateEmbedding` |
| 3 | Cache miss | `generateEmbedding` → `set(cacheKey, embedding)` (async, fire-and-forget) |
| 4 | Cron | `delete_expired_embedding_cache()` to prune TTL-expired entries |

---

## Getting Started

First, install the dependencies using Bun:

```bash
bun install
```

Then, run the development server:

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Supabase Setup

### Local Development (Recommended)

1. **Install dependencies** (Supabase CLI is included as dev dependency):
   ```bash
   bun install
   ```

2. **Initialize Supabase** (if not already done):
   ```bash
   bun run supabase:init
   ```
   
   This creates the local Supabase configuration with custom ports (default + 1000).

3. **Start local Supabase**:
   ```bash
   bun run supabase:start
   ```
   
   This will start Supabase locally with custom ports:
   - API: http://127.0.0.1:55321
   - Studio: http://127.0.0.1:55323
   - DB: localhost:55322

4. **Run migrations**:
   ```bash
   bun run supabase:migrate
   ```
   
   This will apply all migrations from `supabase/migrations/`.

   **Drop DB and push from scratch**: To reset the database and reapply all migrations (e.g. after schema changes), run `bun run supabase:reset`. Then load recipes and binary-quantized embeddings with `bun run vectorize recipes-parsed.json`.

5. **Get local credentials**:
   ```bash
   bun run supabase:status
   ```
   
   Copy the API URL and anon key for your `.env.local` file.

6. **Stop Supabase** (when done):
   ```bash
   bun run supabase:stop
   ```

### Cloud Setup (Production)

1. Create a Supabase project at [https://supabase.com](https://supabase.com)
2. Run the SQL migrations from `supabase/setup.sql` in the Supabase SQL Editor
   - Or run the individual migration files in order from `supabase/migrations/`
   - See [supabase/README.md](./supabase/README.md) for detailed instructions
3. Get your project URL and API keys from the Supabase project settings

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

See `.env.example` for inline comments. Summary:

### Core app (validated in `lib/env.ts` via `serverEnv`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | Postgres connection string (Drizzle, embedding cache, search) |
| `GEMINI_API_KEY` | Yes | Google Gemini API key for recipe-details LLM |
| `GEMINI_MODEL` | Yes | Gemini model id (e.g. `gemini-2.5-flash-lite`, `gemini-2.0-flash`) |

**Local Postgres example** (after `bun run supabase:start`, if DB is on port `55322`):

```
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres
```

### Main page password gate (`lib/auth/main-access.ts`)

The homepage shows a password form until a valid login sets an HTTP-only cookie. Set both variables below.

| Variable | Required | Purpose |
|----------|----------|---------|
| `ACCESS_PASSWORD_HASH` | Yes (for gate) | Scrypt hash of the site password, format `scrypt$<salt_hex>$<hash_hex>` |
| `ACCESS_COOKIE_SECRET` | Yes (for gate) | Secret used to sign the session cookie (e.g. `openssl rand -base64 32`) |

Generate a hash (one-liner in `.env.example`). **In `.env.local`, escape `$` as `\$`** so Next.js / dotenv does not treat them as variable interpolation (otherwise the hash is truncated).

**Note:** Embeddings are generated locally with `@xenova/transformers` — no API keys needed for search. Gemini is only used for recipe details extraction.

## Scripts

### Development
- `bun run dev` - Start Next.js development server
- `bun run build` - Build for production
- `bun run start` - Start production server

### Code Quality
- `bun run lint` - Run Biome linter
- `bun run lint:fix` - Run Biome linter and fix issues
- `bun run format` - Format code with Biome

### Supabase Local
- `bun run supabase` - Run Supabase CLI commands (use `bun run supabase --help` for options)
- `bun run supabase:init` - Initialize Supabase locally (creates config.toml)
- `bun run supabase:start` - Start local Supabase instance
- `bun run supabase:stop` - Stop local Supabase instance
- `bun run supabase:status` - Show local Supabase status and credentials
- `bun run supabase:reset` - Reset local database and run migrations
- `bun run supabase:migrate` - Reset database and apply all migrations

### Data
- `bun run parse:json` - Parse MongoDB JSON to normalized format
- `bun run vectorize` - Vectorize parsed recipes (e.g. `bun run vectorize recipes-parsed.json`)

## Project Structure

See [PLAN.md](./PLAN.md) for detailed implementation plan and architecture.

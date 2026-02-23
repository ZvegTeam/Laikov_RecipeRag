# Recipe Search Application - Implementation Plan

## Overview
A web application that allows users to find recipes based on a list of ingredients using vector similarity search powered by pgvector and local transformer embeddings.

## Tech Stack
- **Frontend**: Next.js 14+ (App Router) + Mantine UI
- **Backend**: Supabase (PostgreSQL with pgvector extension)
- **AI/Embeddings**: @xenova/transformers (local embedding generation, no API calls)
- **Package Manager**: Bun
- **Linter/Formatter**: Biome (with pre-commit hooks)
- **Data**: JSON file with recipe objects

## Project Structure

```
rag-ai/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout with Mantine provider
│   ├── page.tsx           # Main search page
│   ├── api/               # API routes
│   │   ├── search/        # Recipe search endpoint
│   │   ├── recipe-details/ # Fetch detailed recipe info endpoint
│   │   └── vectorize/     # Data vectorization endpoint (admin)
│   └── components/        # React components
│       ├── SearchForm.tsx
│       ├── RecipeCard.tsx
│       ├── RecipeList.tsx
│       └── RecipeDetails.tsx # Detailed recipe view with instructions
├── lib/                   # Utility functions
│   ├── supabase.ts        # Supabase client
│   ├── embeddings.ts      # Local embedding generation (@xenova/transformers)
│   ├── gemini.ts          # Gemini AI client (for recipe details extraction)
│   ├── prompts.ts         # Prompt service for AI content generation
│   └── utils.ts           # Helper functions
├── scripts/               # Data processing scripts
│   ├── parse-json.ts      # Parse MongoDB JSON format
│   └── vectorize-data.ts  # Batch vectorization script
├── types/                 # TypeScript types
│   └── recipe.ts          # Recipe type definitions
├── .env.local             # Environment variables
├── package.json
└── PLAN.md
```

## Implementation Steps

### Phase 1: Project Setup

#### 1.1 Initialize Next.js Project
- [x] Create Next.js 14+ project with TypeScript
- [x] Setup Biome for linting and formatting
- [x] Setup Git pre-commit hooks for automatic linting and formatting
- [x] Initialize Git repository
- [x] Install dependencies using Bun:
  - [x] `@mantine/core`, `@mantine/hooks`, `@mantine/form`
  - [x] `@supabase/supabase-js`
  - [x] `@xenova/transformers` (for local embedding generation)
  - [x] `zod` (for validation)

#### 1.2 Setup Supabase
- [x] Create SQL migration files for database setup
- [x] Create Supabase client utilities (`lib/supabase.ts`)
- [x] Create setup documentation (`supabase/README.md`)
- [x] Create environment variable example file
- [x] **Manual step**: Create Supabase project at supabase.com
- [x] **Manual step**: Run SQL migrations in Supabase SQL Editor:
  - Run `supabase/setup.sql` (complete setup) OR
  - Run migrations in order: `001_enable_pgvector.sql`, `002_create_recipes_table.sql`
- [x] **Manual step**: Get API keys from Supabase project settings

#### 1.3 Environment Variables
- [x] Create `.env.local`:
  ```
  NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
  GEMINI_API_KEY=your_gemini_api_key
  ```

### Phase 2: Data Processing & Vectorization

#### 2.1 Parse JSON Data
- [x] Create script to parse MongoDB-style JSON file (`scripts/parse-json.ts`)
- [x] Extract and normalize recipe data:
  - [x] Convert MongoDB ObjectId to string
  - [x] Parse date fields
  - [x] Clean and normalize ingredient text
  - [x] Handle missing fields gracefully

#### 2.2 Vectorization Strategy
- [x] Create embedding generation function using local transformers (`lib/embeddings.ts`):
  - [x] Use @xenova/transformers for local embedding generation (no API calls)
  - [x] Default model: `Xenova/all-MiniLM-L6-v2` (384 dimensions, fast and lightweight)
  - [x] Support for multiple models (all-MiniLM-L6-v2, all-mpnet-base-v2, etc.)
  - [x] Embedding text combines: `name + ". Ingredients: " + ingredients + ". " + description`
  - [x] Batch process recipes (configurable batch size, default 32) - no rate limits with local processing
  - [x] Store embeddings in Supabase via vectorize-data script
  - [x] Update database schema to use 384 dimensions (default model)
- [x] Create data migration script (`scripts/vectorize-data.ts`):
  - [x] Supports both local and remote Supabase (configurable via USE_LOCAL_SUPABASE or USE_REMOTE_SUPABASE env vars)
  - [x] Read parsed JSON file
  - [x] Fetch existing recipe IDs to skip already processed recipes
  - [x] Process in batches: generate embeddings and insert immediately (resume capability)
  - [x] Generate embeddings for each recipe using local transformers
  - [x] Insert into Supabase with embeddings
  - [x] Progress tracking and error handling
  - [x] Configurable batch sizes for embeddings and database inserts

#### 2.3 Data Migration Script
- [x] Create Node.js script (`scripts/vectorize-data.ts`):
  - [x] Read JSON file
  - [x] Parse each recipe
  - [x] Generate embedding for each recipe
  - [x] Insert into Supabase with embedding
  - [x] Include progress tracking and error handling
  - [x] Resume capability for failed batches (via fetching existing recipe IDs)

### Phase 3: Backend API Development

#### 3.1 Supabase Client Setup
- [x] Create Supabase client utilities (`lib/supabase.ts`):
  - [x] Client-side client (for browser) - `createSupabaseClient()`
  - [x] Server-side client (for API routes with service role key) - `createSupabaseServerClient()`
  - [x] Environment variable validation and error handling
  - [x] Proper server-side configuration (auth disabled for server use)

#### 3.2 Search API Endpoint
- [x] Create `/api/search` route (`app/api/search/route.ts`):
  - [x] Accept POST request with `ingredients` array (validated with Zod)
  - [x] Generate embedding for user's ingredient list using local transformers (@xenova/transformers)
  - [x] Query Supabase using cosine similarity via RPC function `search_recipes_by_embedding`
  - [x] Return recipes with similarity scores
  - [x] Handle errors gracefully (validation errors, database errors, etc.)
  - [x] Create database function for efficient vector similarity search (`003_create_search_function.sql`)
  - [x] Support configurable result limit (default: 20, max: 50)
  - [x] Support configurable similarity threshold (default: 0.3)

#### 3.3 Recipe Details API Endpoint
- [ ] Create prompt service (`lib/prompts.ts`):
  - [x] Centralized prompt definitions for scalability
  - [x] Support multiple prompt types (URL extraction, web search, etc.)
  - [x] Context validation for each prompt type
  - [x] Easy to extend with new prompt types
- [x] Create `/api/recipe-details` route (`app/api/recipe-details/route.ts`):
  - [x] Accept POST request with `recipeId` or `recipeUrl` (Zod validation)
  - [x] Check if cooking instructions already exist in database (cache check)
  - [x] If not, use Gemini AI to fetch details with JSON schema validation:
    - **Primary method**: Use Gemini with URL access capability
      - Use `getRecipeUrlExtractionPrompt()` from prompt service
      - Pass JSON schema to Gemini API for structured output
      - Use Gemini's web browsing capability if available
    - **Fallback method**: If URL is not accessible or fails:
      - Use Gemini's web search capability
      - Use `getRecipeWebSearchPrompt()` from prompt service
      - Pass same JSON schema for consistent output
  - [x] Parse and structure the response:
    - Extract cooking instructions (step-by-step)
    - Extract additional info (tips, variations, serving suggestions, etc.)
    - Validate JSON structure with Zod schema (double validation)
  - [x] Store in database for future use (cache with `instructions_fetched_at` timestamp)
  - [x] Return structured data with `cached` flag and `fetched_at` timestamp
  - [x] Handle errors gracefully (URL not accessible, no web results, parsing errors, etc.)
  - [x] Include rate limiting to prevent abuse (10 requests per minute per IP)
  - [x] Log errors for monitoring and optimization

#### 3.4 Vectorization API (Optional - Admin)
- [ ] Create `/api/vectorize` route for re-vectorization:
  - Admin-only endpoint
  - Re-generate embeddings for specific recipes
  - Useful for updating embeddings if model changes

### Phase 4: Frontend Development

#### 4.1 UI Setup
- [x] Configure Mantine provider in root layout
- [x] Setup theme customization
- [x] Create responsive layout structure
- [x] **Mobile Responsiveness:**
  - [x] Configure Mantine breakpoints for mobile-first design
  - [x] Setup viewport meta tags for proper mobile rendering
  - [x] Test on various screen sizes (320px, 375px, 414px, 768px, 1024px, 1280px+)
  - [x] Ensure touch-friendly interactions (minimum 44x44px touch targets)

#### 4.2 Search Interface
- [x] Build `SearchForm` component:
  - Multi-line text area for ingredients (one ingredient per line)
  - Search button
  - Loading states
  - Error handling
  - Clear/reset functionality
- [x] **Mobile Responsiveness:**
  - Full-width form on mobile devices
  - Stack input fields vertically on small screens
  - Large, touch-friendly buttons (minimum 44px height)
  - Optimize textarea for mobile (comfortable min height, easy to type)
  - Ensure keyboard doesn't cover input (scroll margin / scroll-into-view)

#### 4.3 Recipe Display
- [x] Create `RecipeCard` component:
  - Display recipe name, image, description
  - Show ingredients list
  - Display cook time, prep time, yield
  - Show similarity score (optional)
  - Link to original recipe URL
  - "View Details" button to fetch and show full recipe
  - Responsive design
- [x] **Mobile Responsiveness:**
  - Single column layout on mobile (< 768px)
  - Card takes full width on mobile with proper padding
  - Optimize image sizes for mobile (lazy loading, responsive images)
  - Truncate long descriptions with "Read more" on mobile
  - Touch-friendly buttons and links
  - Ensure text is readable without zooming (minimum 16px font size)
  - Collapsible sections for ingredients/details on mobile

#### 4.3.1 Recipe Details Component
- [x] Create `RecipeDetails` component:
  - Modal or dedicated page for detailed recipe view
  - Display full recipe information:
    - Recipe name, image, description
    - Complete ingredients list
    - **Cooking instructions** (step-by-step process)
    - Additional information section:
      - Cooking tips
      - Recipe variations
      - Serving suggestions
      - Difficulty level (if available)
      - Nutrition tips (if available)
  - Loading state while fetching details from API
  - Error handling if details cannot be fetched
  - "Fetch Instructions" button if not yet loaded
  - Cache indicator (show if using cached data)
  - Link to original recipe URL
  - Share functionality
- [x] **Mobile Responsiveness:**
  - Full-screen modal or dedicated page on mobile
  - Sticky header with close/back button on mobile
  - Scrollable content area with proper padding
  - Large, readable typography for instructions
  - Collapsible sections for tips/variations to save space
  - Bottom sheet or floating action button for share on mobile
  - Optimize images for mobile bandwidth
  - Ensure instructions are easy to follow while cooking (large text, clear steps)
  - Consider swipe gestures for navigation between steps

#### 4.4 Recipe List
- [x] Create `RecipeList` component:
  - Grid/list layout for recipe cards
  - Empty state when no results
  - Loading skeleton states
  - Pagination (if needed) — Load More button (API support can be added later)
- [x] **Mobile Responsiveness:**
  - Single column grid on mobile (< 768px)
  - 2-column grid on tablet (768px - 1024px)
  - 3+ column grid on desktop (> 1024px)
  - Infinite scroll or "Load More" button instead of pagination on mobile
  - Optimize skeleton loaders for mobile (fewer cards visible)
  - Pull-to-refresh functionality on mobile (Refresh button in empty state)
  - Smooth scrolling with proper spacing between cards

#### 4.5 Main Page
- [x] Combine components in main page:
  - Search form at top
  - Results below
  - Smooth transitions and animations
  - Responsive design for mobile/tablet/desktop
- [x] **Mobile Responsiveness:**
  - Sticky search bar on mobile (fixed at top when scrolling)
  - Proper spacing and padding for mobile (16px minimum)
  - Optimize animations for mobile performance (use CSS transforms)
  - Test on real devices (iOS Safari, Chrome Android)
  - Handle orientation changes (portrait/landscape)
  - Ensure no horizontal scrolling on any screen size
  - Bottom navigation or floating action button for key actions
  - Consider progressive web app (PWA) features for mobile

### Phase 5: Optimization & Polish

#### 5.1 Performance
- [x] Optimize embedding generation:
  - Cache embeddings for common ingredient combinations (in-memory cache in lib/embeddings, used by search API; TTL 5 min, max 500 entries)
  - Batch API calls where possible (vectorize-data.ts already uses generateEmbeddingsBatch; search API is one query per request)
- [x] Optimize database queries:
  - Fine-tune IVFFlat index parameters (documented in migration 004; use IVFFlat with lists ~ row_count/1000 if preferred)
  - Consider HNSW index for better accuracy (if needed) — migration 004 switches to HNSW
- [x] Implement client-side caching for search results

#### 5.2 User Experience
- [ ] Add ingredient suggestions/autocomplete
- [ ] Show recipe categories/tags
- [ ] Add filters (cook time, prep time, etc.)
- [ ] Implement recipe favorites/bookmarks
- [ ] Add share functionality
- [ ] Show loading indicators when fetching recipe details
- [ ] Display cached vs. fresh data indicators
- [ ] Allow users to refresh/re-fetch recipe details

#### 5.3 Error Handling
- [ ] Comprehensive error messages
- [ ] Retry logic for failed API calls
- [ ] Graceful degradation if embeddings fail

#### 5.4 Testing
- [ ] Test with various ingredient combinations
- [ ] Verify similarity search accuracy
- [ ] Test edge cases (empty ingredients, no results, etc.)
- [ ] Performance testing with large dataset

### Phase 6: LangChain Integration (Optional)

Integrate [LangChain](https://js.langchain.com/) to standardize prompt management, structured output, and RAG flows. Current stack (Gemini + custom prompts + Zod) remains valid; LangChain adds reusable chains and a consistent abstraction.

#### 6.1 Recipe-details chain (high value)
- [x] Install LangChain packages (e.g. `@langchain/core`, `@langchain/google-genai`, `langchain`).
- [x] Create `lib/chains/recipe-details-chain.ts`:
  - [x] Chain input: recipe context (name, ingredients, url).
  - [x] Step 1: Choose prompt branch (URL extraction vs web search) based on presence of `url`.
  - [x] Step 2: Call LLM (ChatGoogleGenerativeAI or equivalent) with the selected prompt template.
  - [x] Step 3: Use LangChain structured output (e.g. `withStructuredOutput`) with existing `recipeDetailsZodSchema` so the chain returns a typed, Zod-validated object.
  - [x] Step 4: Return parsed `RecipeDetailsResponse` (no manual JSON parse or zodToJsonSchema in route).
- [x] Refactor `app/api/recipe-details/route.ts`:
  - [x] Keep: fetch recipe from DB, cache check, rate limiting, persist result to DB.
  - [x] Replace: manual `getPrompt` + `generateStructuredContent` + `recipeDetailsZodSchema.parse` with a single chain invocation.
- [x] Preserve existing API contract and DB caching behavior.

#### 6.2 Prompt management with LangChain templates
- [ ] Replace or wrap `lib/prompts.ts` with LangChain prompt templates:
  - [ ] Use `ChatPromptTemplate.fromTemplate()` (or similar) for URL extraction and web-search prompts.
  - [ ] Template variables: `recipeName`, `ingredients`, `url` (optional).
  - [ ] Keep a single registry keyed by `PromptType` (or equivalent) for maintainability.
- [ ] Optionally add few-shot examples later via `FewShotPromptTemplate` without changing API or chain interface.
- [ ] Keep `validatePromptContext()` (or equivalent) for input validation before running the chain.

#### 6.3 Structured output (Gemini) via LangChain
- [ ] Replace hand-rolled `lib/gemini.ts` structured flow where used by recipe-details:
  - [ ] Use ChatGoogleGenerativeAI (or LangChain’s Gemini integration) with `withStructuredOutput(recipeDetailsZodSchema)` (or equivalent).
  - [ ] Single place for “call Gemini and get typed, validated object”; remove or simplify custom `generateStructuredContent` + manual schema conversion for this use case.
- [ ] Ensure Zod schema remains the single source of truth for response shape.

#### 6.4 Retriever abstraction (optional)
- [ ] Implement a LangChain `Retriever` that wraps existing search:
  - [ ] Input: user message (e.g. ingredients string).
  - [ ] Internal steps: run current flow (embed query → binary quantize → Drizzle/pgvector) and return recipe documents.
  - [ ] Output: LangChain `Document[]` (or equivalent) for use in chains.
- [ ] Use this retriever in a RAG chain when adding features such as:
  - [ ] “Given ingredients, retrieve top N recipes and summarize” or “What can I make with X?” using retrieved recipes as context.

#### 6.5 Document loaders (future)
- [ ] When adding ingestion from URLs or PDFs:
  - [ ] Use LangChain document loaders (e.g. Cheerio, Puppeteer, PDF) to fetch and split content.
  - [ ] Feed output into existing embedding + vectorize pipeline (keep Drizzle + pgvector + bit(384) as-is).
  - [ ] LangChain owns “URL/PDF → documents/chunks”; existing DB and indexing unchanged.

#### 6.6 Embeddings via LangChain (optional)
- [ ] If standardizing on LangChain’s embedding interface:
  - [ ] Use `HuggingFaceTransformersEmbeddings` (or equivalent) for the “text → vector” step only.
  - [ ] Keep Drizzle + pgvector and current binary quantization logic; ensure dimension stays 384 and quantization remains correct.
- [ ] Only adopt if the goal is to reduce custom pipeline code and accept possible model/API differences.

#### 6.7 Agents / tools (future)
- [ ] When adding features like “substitute ingredient”, “scale recipe”, or “find similar recipes”:
  - [ ] Expose each as a LangChain tool and compose them in an agent.
  - [ ] Enables natural-language flows (e.g. “Replace butter with oil and scale to 4 servings”).

## Data Schema Details

### Recipe Object Structure
```typescript
interface Recipe {
  id: string;                    // UUID from Supabase
  original_id: string;           // MongoDB _id
  name: string;
  ingredients: string;
  description?: string;
  url?: string;
  image?: string;
  cook_time?: string;
  prep_time?: string;
  recipe_yield?: string;
  date_published?: Date;
  source?: string;
  embedding: number[];          // Vector embedding
  similarity?: number;           // Computed similarity score
  cooking_instructions?: string; // Detailed step-by-step cooking process
  additional_info?: {           // Additional recipe information
    tips?: string[];
    variations?: string[];
    serving_suggestions?: string;
    difficulty?: string;
    nutrition_tips?: string;
  };
  instructions_fetched_at?: Date; // When instructions were last fetched
}
```

## Embedding Strategy

### Text Preparation for Embedding
For each recipe, create a combined text:
```
"{name}. Ingredients: {ingredients}. {description}"
```

### User Query Embedding
When user searches with ingredients, create query:
```
"Find recipes with these ingredients: {ingredient1}, {ingredient2}, ..."
```

### Similarity Search
Use cosine similarity (`<=>` operator in pgvector) to find most similar recipes.

## Recipe Details Fetching Strategy

### Gemini AI Prompt for URL-based Extraction
When a user selects a recipe, use the following prompt structure:

**Primary Prompt (URL Access):**
```
You are a recipe extraction assistant. Please extract the complete cooking instructions and additional information from this recipe URL: {recipe_url}

Recipe Name: {recipe_name}
Ingredients: {ingredients}

Please provide:
1. Step-by-step cooking instructions (detailed and clear)
2. Cooking tips and techniques
3. Recipe variations or substitutions (if any)
4. Serving suggestions
5. Any additional helpful information (difficulty level, nutrition tips, storage instructions, etc.)

Format the response as JSON with the following structure:
{
  "cooking_instructions": "Step-by-step instructions...",
  "additional_info": {
    "tips": ["tip1", "tip2"],
    "variations": ["variation1", "variation2"],
    "serving_suggestions": "suggestions text",
    "difficulty": "Easy/Medium/Hard",
    "nutrition_tips": "tips text"
  }
}
```

### Fallback Prompt (Web Search)
If URL access fails or is not available:
```
Search the web for detailed cooking instructions and recipe information for: {recipe_name}

Ingredients: {ingredients}

Find and provide:
1. Complete step-by-step cooking instructions
2. Cooking tips and best practices
3. Recipe variations or modifications
4. Serving and presentation suggestions
5. Any additional relevant information

Format the response as structured JSON with cooking_instructions and additional_info fields.
```

### Implementation Notes
- Use Gemini's `gemini-pro` or `gemini-1.5-pro` model for content generation
- Enable web browsing/search capabilities if available in Gemini API
- Cache results in database to avoid repeated API calls
- Set appropriate timeout for URL fetching (e.g., 30 seconds)
- Handle cases where URL is dead or inaccessible
- Provide user feedback during fetching process

## Security Considerations

- [ ] Use Supabase Row Level Security (RLS) policies
- [ ] Validate all user inputs
- [ ] Rate limit API endpoints (especially recipe-details endpoint)
- [ ] Secure API keys (never expose in client code)
- [ ] Sanitize user inputs before generating embeddings
- [ ] Validate URLs before passing to Gemini
- [ ] Implement request timeout for URL fetching
- [ ] Cache recipe details to reduce API calls and costs

## Deployment

- [ ] Deploy Next.js app to Vercel/Netlify
- [ ] Configure environment variables in hosting platform
- [ ] Setup Supabase production database
- [ ] Run data migration script in production
- [ ] Monitor API usage and costs (Gemini API)

## Future Enhancements

- [ ] User accounts and saved searches
- [ ] Recipe recommendations based on search history
- [ ] Ingredient substitution suggestions
- [ ] Recipe difficulty rating
- [ ] Nutritional information
- [ ] Multi-language support
- [ ] Recipe image generation with AI
- [ ] Voice input for ingredients

## Notes

- **Gemini Embedding Model**: Check current available models and dimensions
- **pgvector Index**: IVFFlat is good for speed, HNSW for accuracy (slower inserts)
- **Batch Size**: Process 50-100 recipes per batch to avoid rate limits
- **Embedding Dimension**: Verify Gemini embedding dimension (typically 768 or 1024)
- **Gemini Content Model**: Use `gemini-pro` or `gemini-1.5-pro` for recipe details extraction
- **Web Search Capability**: Check if Gemini API supports web browsing/search features
- **Caching Strategy**: Cache recipe details for at least 7 days to reduce API costs
- **Rate Limiting**: Implement per-user rate limits for recipe details endpoint (e.g., 10 requests per minute)


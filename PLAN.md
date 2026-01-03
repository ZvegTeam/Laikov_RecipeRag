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
│   ├── gemini.ts          # Gemini AI client
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
  - [x] Generate embeddings for each recipe
  - [x] Insert into Supabase with embeddings
  - [x] Progress tracking and error handling
  - [x] Configurable batch sizes for embeddings and database inserts

#### 2.3 Data Migration Script
- [ ] Create Node.js script (`scripts/vectorize-data.ts`):
  - Read JSON file
  - Parse each recipe
  - Generate embedding for each recipe
  - Insert into Supabase with embedding
  - Include progress tracking and error handling
  - Resume capability for failed batches

### Phase 3: Backend API Development

#### 3.1 Supabase Client Setup
- [ ] Create Supabase client utilities:
  - Client-side client (for browser)
  - Server-side client (for API routes with service role key)

#### 3.2 Search API Endpoint
- [ ] Create `/api/search` route:
  - Accept POST request with `ingredients` array
  - Generate embedding for user's ingredient list using Gemini
  - Query Supabase using cosine similarity:
    ```sql
    SELECT *, 1 - (embedding <=> $1::vector) as similarity
    FROM recipes
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> $1::vector
    LIMIT 20;
    ```
  - Return recipes with similarity scores
  - Handle errors gracefully

#### 3.3 Recipe Details API Endpoint
- [ ] Create `/api/recipe-details` route:
  - Accept POST request with `recipeId` or `recipeUrl`
  - Check if cooking instructions already exist in database
  - If not, use Gemini AI to fetch details:
    - **Primary method**: Use Gemini with URL access capability
      - Prompt: "Extract the complete cooking instructions, step-by-step process, and any additional information (tips, variations, serving suggestions) from this recipe URL: {url}. Return the information in a structured format."
      - Use Gemini's web browsing capability if available
    - **Fallback method**: If URL is not accessible or fails:
      - Use Gemini's web search capability
      - Prompt: "Search the web for cooking instructions and detailed recipe information for: {recipe_name}. Include step-by-step cooking process, tips, and any additional relevant information."
  - Parse and structure the response:
    - Extract cooking instructions (step-by-step)
    - Extract additional info (tips, variations, serving suggestions, etc.)
  - Store in database for future use (cache)
  - Return structured data:
    ```typescript
    {
      cooking_instructions: string,
      additional_info: {
        tips?: string[],
        variations?: string[],
        serving_suggestions?: string,
        difficulty?: string,
        nutrition_tips?: string
      }
    }
    ```
  - Handle errors gracefully (URL not accessible, no web results, etc.)
  - Include rate limiting to prevent abuse

#### 3.4 Vectorization API (Optional - Admin)
- [ ] Create `/api/vectorize` route for re-vectorization:
  - Admin-only endpoint
  - Re-generate embeddings for specific recipes
  - Useful for updating embeddings if model changes

### Phase 4: Frontend Development

#### 4.1 UI Setup
- [ ] Configure Mantine provider in root layout
- [ ] Setup theme customization
- [ ] Create responsive layout structure

#### 4.2 Search Interface
- [ ] Build `SearchForm` component:
  - Multi-select or tag input for ingredients
  - Search button
  - Loading states
  - Error handling
  - Clear/reset functionality

#### 4.3 Recipe Display
- [ ] Create `RecipeCard` component:
  - Display recipe name, image, description
  - Show ingredients list
  - Display cook time, prep time, yield
  - Show similarity score (optional)
  - Link to original recipe URL
  - "View Details" button to fetch and show full recipe
  - Responsive design

#### 4.3.1 Recipe Details Component
- [ ] Create `RecipeDetails` component:
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

#### 4.4 Recipe List
- [ ] Create `RecipeList` component:
  - Grid/list layout for recipe cards
  - Empty state when no results
  - Loading skeleton states
  - Pagination (if needed)

#### 4.5 Main Page
- [ ] Combine components in main page:
  - Search form at top
  - Results below
  - Smooth transitions and animations
  - Responsive design for mobile/tablet/desktop

### Phase 5: Optimization & Polish

#### 5.1 Performance
- [ ] Optimize embedding generation:
  - Cache embeddings for common ingredient combinations
  - Batch API calls where possible
- [ ] Optimize database queries:
  - Fine-tune IVFFlat index parameters
  - Consider HNSW index for better accuracy (if needed)
- [ ] Implement client-side caching for search results

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


# Recipe Search Application

A web application that allows users to find recipes based on a list of ingredients using vector similarity search powered by pgvector and Gemini AI embeddings.

## Tech Stack

- **Frontend**: Next.js 14+ (App Router) + Mantine UI
- **Backend**: Supabase (PostgreSQL with pgvector extension)
- **AI/Embeddings**: Google Gemini AI (for generating embeddings)
- **Package Manager**: Bun
- **Linter/Formatter**: Biome
- **Data**: JSON file with recipe objects

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

Copy `.env.local.example` to `.env.local` and fill in your values:

```bash
cp .env.local.example .env.local
```

Required environment variables:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GEMINI_API_KEY=your_gemini_api_key
```

**For local development**, use the values from `bun run supabase:status` (or `supabase status`):
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<from supabase status>
```

**For production**, get these values from:
- **Supabase**: Project Settings → API
- **Gemini**: [Google AI Studio](https://makersuite.google.com/app/apikey)

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

## Project Structure

See [PLAN.md](./PLAN.md) for detailed implementation plan and project structure.


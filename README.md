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

## Environment Variables

Create a `.env.local` file in the root directory:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GEMINI_API_KEY=your_gemini_api_key
```

## Scripts

- `bun run dev` - Start development server
- `bun run build` - Build for production
- `bun run start` - Start production server
- `bun run lint` - Run Biome linter
- `bun run lint:fix` - Run Biome linter and fix issues
- `bun run format` - Format code with Biome

## Project Structure

See [PLAN.md](./PLAN.md) for detailed implementation plan and project structure.


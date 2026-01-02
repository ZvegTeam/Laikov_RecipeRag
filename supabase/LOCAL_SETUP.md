# Local Supabase Development Setup

This guide explains how to set up and use Supabase locally for development.

## Prerequisites

The Supabase CLI is included as a dev dependency in this project. Just install project dependencies:

```bash
bun install
```

Verify installation:
```bash
bun run supabase --version
# or
supabase --version
```

## Port Configuration

This project uses custom ports (default + 1000) to avoid conflicts:

- **API**: `55321` (default: 54321)
- **Database**: `55322` (default: 54322)
- **Studio**: `55323` (default: 54323)
- **Inbucket (Email)**: `55324` (default: 54324)
- **Storage**: `55325` (default: 54325)

These are configured in `supabase/config.toml`.

## Quick Start

1. **Initialize Supabase** (first time only):
   ```bash
   bun run supabase:init
   ```

2. **Start Supabase**:
   ```bash
   bun run supabase:start
   ```

3. **Check status and get credentials**:
   ```bash
   bun run supabase:status
   ```

4. **Apply migrations** (if not auto-applied):
   ```bash
   bun run supabase:migrate
   ```

5. **Access Supabase Studio**:
   Open http://127.0.0.1:55323 in your browser

## Common Commands

### Start/Stop
```bash
# Start Supabase
bun run supabase:start

# Stop Supabase
bun run supabase:stop

# Check status
bun run supabase:status
```

### Database Management
```bash
# Reset database and apply all migrations
bun run supabase:reset

# Apply migrations only
bun run supabase:migrate

# Create a new migration
bun run supabase migration new migration_name
# or
supabase migration new migration_name

# View database logs
bun run supabase db logs
# or
supabase db logs
```

### Accessing the Database
```bash
# Connect via psql
bun run supabase db connect
# or
supabase db connect

# Or use the connection string from status
psql postgresql://postgres:postgres@127.0.0.1:55322/postgres
```

## Environment Variables for Local Development

After starting Supabase, run `bun run supabase:status` to get your local credentials:

```bash
# Example output:
API URL: http://127.0.0.1:55321
DB URL: postgresql://postgres:postgres@127.0.0.1:55322/postgres
Studio URL: http://127.0.0.1:55323
anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Add these to your `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from status>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from status>
```

## Migrations

Migrations are stored in `supabase/migrations/` and are automatically applied when you start Supabase or run `supabase db reset`.

### Creating a New Migration

```bash
bun run supabase migration new add_new_column
# or
supabase migration new add_new_column
```

This creates a new file in `supabase/migrations/` with a timestamp prefix.

### Migration Files

- `001_enable_pgvector.sql` - Enables pgvector extension
- `002_create_recipes_table.sql` - Creates recipes table with indexes

## Troubleshooting

### Port Already in Use

If you get port conflicts, you can:
1. Stop other services using those ports
2. Or modify `supabase/config.toml` to use different ports

### Database Reset Issues

If migrations fail:
```bash
# Stop Supabase
bun run supabase:stop

# Remove local data (WARNING: deletes all local data)
rm -rf .supabase

# Start fresh
bun run supabase:start
```

### pgvector Extension Not Found

If you see errors about pgvector:
1. Make sure migration `001_enable_pgvector.sql` ran successfully
2. Check in Studio: Database → Extensions
3. Manually enable: `CREATE EXTENSION IF NOT EXISTS vector;`

### Connection Issues

If you can't connect:
1. Verify Supabase is running: `bun run supabase:status`
2. Check the ports match your `.env.local`
3. Ensure Docker is running (Supabase CLI uses Docker)

## Docker Requirements

Supabase CLI requires Docker to be running. Make sure Docker Desktop is installed and running before starting Supabase.

## Useful Links

- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [Local Development Guide](https://supabase.com/docs/guides/cli/local-development)
- [Migration Guide](https://supabase.com/docs/guides/cli/local-development#database-migrations)


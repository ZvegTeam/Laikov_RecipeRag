import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/** Default TTL for cache entries: 5 minutes */
const DEFAULT_TTL_SECONDS = 5 * 60;

/**
 * Embedding cache service: store and retrieve query embeddings by key (e.g. normalized ingredients).
 * Uses the embedding_cache table with PostgreSQL hstore (via get/set/delete RPCs).
 */
export const embeddingCacheService = {
  async get(cacheKey: string): Promise<number[] | null> {
    try {
      const result = await db.execute<{ get_embedding_cache: string | null }>(
        sql`SELECT get_embedding_cache(${cacheKey}) AS get_embedding_cache`
      );
      const rows = Array.isArray(result)
        ? result
        : ((result as { rows: { get_embedding_cache: string | null }[] }).rows ?? []);
      const data = rows[0]?.get_embedding_cache ?? null;
      if (data == null || typeof data !== "string") return null;
      const parsed = JSON.parse(data) as unknown;
      return Array.isArray(parsed) ? (parsed as number[]) : null;
    } catch (e) {
      console.warn("Embedding cache get error:", e);
      return null;
    }
  },

  async set(
    cacheKey: string,
    embedding: number[],
    ttlSeconds: number = DEFAULT_TTL_SECONDS
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    try {
      await db.execute(
        sql`SELECT set_embedding_cache(${cacheKey}, ${JSON.stringify(embedding)}, ${expiresAt}::timestamptz)`
      );
    } catch (e) {
      console.warn("Embedding cache set error:", e);
    }
  },

  async deleteExpired(): Promise<number> {
    try {
      const result = await db.execute<{ delete_expired_embedding_cache: number }>(
        sql`SELECT delete_expired_embedding_cache() AS delete_expired_embedding_cache`
      );
      const rows = Array.isArray(result)
        ? result
        : ((result as { rows: { delete_expired_embedding_cache: number }[] }).rows ?? []);
      const data = rows[0]?.delete_expired_embedding_cache ?? 0;
      return typeof data === "number" ? data : 0;
    } catch (e) {
      console.warn("Embedding cache deleteExpired error:", e);
      return 0;
    }
  },
};

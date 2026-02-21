import { createSupabaseServerClient } from "@/lib/supabase";

/** Default TTL for cache entries: 5 minutes */
const DEFAULT_TTL_SECONDS = 5 * 60;

/**
 * Embedding cache service: store and retrieve query embeddings by key (e.g. normalized ingredients).
 * Uses the embedding_cache table with PostgreSQL hstore for the payload (embedding as JSON text + expires_at).
 */
export const embeddingCacheService = {
  /**
   * Get a cached embedding by key. Returns null if missing or expired.
   */
  async get(cacheKey: string): Promise<number[] | null> {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_embedding_cache", {
      p_key: cacheKey,
    });

    if (error) {
      console.warn("Embedding cache get error:", error.message);
      return null;
    }
    if (data == null || typeof data !== "string") return null;

    try {
      const parsed = JSON.parse(data) as unknown;
      return Array.isArray(parsed) ? (parsed as number[]) : null;
    } catch {
      return null;
    }
  },

  /**
   * Store an embedding under the given key. Overwrites existing; sets expires_at to now + TTL.
   */
  async set(
    cacheKey: string,
    embedding: number[],
    ttlSeconds: number = DEFAULT_TTL_SECONDS
  ): Promise<void> {
    const supabase = createSupabaseServerClient();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    const { error } = await supabase.rpc("set_embedding_cache", {
      p_key: cacheKey,
      p_embedding_json: JSON.stringify(embedding),
      p_expires_at: expiresAt,
    });

    if (error) {
      console.warn("Embedding cache set error:", error.message);
    }
  },

  /**
   * Delete expired rows. Call periodically to keep the table small.
   */
  async deleteExpired(): Promise<number> {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.rpc("delete_expired_embedding_cache");

    if (error) {
      console.warn("Embedding cache deleteExpired error:", error.message);
      return 0;
    }
    return typeof data === "number" ? data : 0;
  },
};

/**
 * Recipe vector search: embed query → binary quantize → pgvector (HNSW Hamming).
 * Shared by search API and LangChain RecipeRetriever.
 */

import { db } from "@/lib/db";
import { embeddingCacheService } from "@/lib/embedding-cache";
import { generateEmbedding } from "@/lib/embeddings";
import { binaryQuantize } from "@/lib/quantize";
import type { Recipe } from "@/types/recipe";
import { sql } from "drizzle-orm";

export interface SearchRecipesOptions {
  /** Max number of recipes to return (default: 20, max: 50) */
  limit?: number;
  /** Optional cache key for embedding cache; if omitted, queryText is used */
  cacheKey?: string;
}

export interface RecipeSearchResult extends Recipe {
  similarity: number;
}

/**
 * Search recipes by a text query (e.g. ingredients or natural language).
 * Embeds the query, binary quantizes, and queries pgvector via HNSW Hamming.
 */
export async function searchRecipesByQuery(
  queryText: string,
  options: SearchRecipesOptions = {}
): Promise<RecipeSearchResult[]> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  const cacheKey = options.cacheKey ?? queryText;

  let queryEmbedding = await embeddingCacheService.get(cacheKey);
  if (!queryEmbedding) {
    queryEmbedding = await generateEmbedding(queryText);
    void embeddingCacheService.set(cacheKey, queryEmbedding);
  }

  const queryBit = binaryQuantize(queryEmbedding);

  const result = await db.execute(
    sql`
      SELECT
        r.id, r.original_id, r.name, r.ingredients, r.description, r.url, r.image,
        r.cook_time, r.prep_time, r.recipe_yield, r.date_published, r.source,
        r.cooking_instructions, r.additional_info, r.instructions_fetched_at,
        r.created_at, r.updated_at,
        (1 - ((e.embedding <~> ${queryBit}::bit(384)) / 384.0)) AS similarity
      FROM recipes r
      INNER JOIN recipe_embeddings e ON e.recipe_id = r.id
      ORDER BY e.embedding <~> ${queryBit}::bit(384)
      LIMIT ${limit}
    `
  );

  const rows = Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? []);
  return rows as RecipeSearchResult[];
}
